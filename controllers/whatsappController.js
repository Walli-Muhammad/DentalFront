/**
 * controllers/whatsappController.js — WhatsApp webhook business logic
 *
 * verifyWebhook        → Handles Meta's one-time GET verification challenge
 * handleIncomingMessage → Receives Meta POST payloads, routes text messages
 *                         through the AI layer, and replies via the Cloud API
 *
 * Flow for inbound text messages:
 *   1. Acknowledge with 200 OK immediately (prevents Meta retries)
 *   2. Check Asia/Karachi working hours
 *      • Out-of-hours → send static template, skip AI (saves cost)
 *      • In-hours     → call generateResponse() with conversation history
 *   3. If AI returns appointmentData → persist to Google Sheets
 *   4. Send AI text response back to user via sendWhatsAppMessage()
 */

import axios from 'axios';
import { generateResponse }       from '../services/aiService.js';
import { addAppointment }         from '../services/sheetsService.js';
import { isWithinWorkingHours, getOutOfHoursMessage } from '../utils/timeUtils.js';

// ── WhatsApp Cloud API config ─────────────────────────────────────────────────

const WA_API_VERSION = 'v17.0';
const WA_BASE_URL    = `https://graph.facebook.com/${WA_API_VERSION}`;

/**
 * Sends a plain-text message to a WhatsApp number via the Meta Cloud API.
 *
 * @param {string} to          — Recipient's phone number (international, no +)
 * @param {string} messageText — Text body to send
 * @returns {Promise<void>}
 */
async function sendWhatsAppMessage(to, messageText) {
  const phoneNumberId   = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken     = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'Missing env vars: WHATSAPP_PHONE_NUMBER_ID and/or WHATSAPP_ACCESS_TOKEN'
    );
  }

  const url     = `${WA_BASE_URL}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to,
    type: 'text',
    text: { body: messageText },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000, // 10 s — fail fast rather than hanging
    });

    console.log('[WhatsApp Send] ✅ Message sent to', to, {
      messageId: response.data?.messages?.[0]?.id,
    });
  } catch (err) {
    const status  = err.response?.status;
    const details = err.response?.data?.error ?? err.message;
    console.error('[WhatsApp Send] ❌ Failed to send message', { to, status, details });
    throw new Error(`WhatsApp send failed (${status}): ${JSON.stringify(details)}`);
  }
}

// ── In-memory conversation store ──────────────────────────────────────────────
// MVP store: keyed by sender's phone number (wa_id).
// Replace with Redis / DB in production to survive restarts.
/** @type {Map<string, Array<{ role: 'user'|'assistant', content: string }>>} */
const conversationStore = new Map();

const MAX_HISTORY_TURNS = 10; // keep last 10 exchanges to cap token usage

/**
 * Retrieves the conversation history for a given sender and appends the
 * new user turn, returning the full history for the AI call.
 *
 * @param {string} senderId
 * @param {string} userMessage
 * @returns {Array<{ role: string, content: string }>}
 */
function buildHistory(senderId, userMessage) {
  const history = conversationStore.get(senderId) ?? [];
  history.push({ role: 'user', content: userMessage });

  // Trim to the last N turns (each turn = user + assistant = 2 entries)
  const trimmed = history.slice(-(MAX_HISTORY_TURNS * 2));
  conversationStore.set(senderId, trimmed);

  return trimmed;
}

/**
 * Saves the assistant's reply to history after a successful AI call.
 *
 * @param {string} senderId
 * @param {string} assistantReply
 */
function saveAssistantReply(senderId, assistantReply) {
  const history = conversationStore.get(senderId) ?? [];
  history.push({ role: 'assistant', content: assistantReply });
  conversationStore.set(senderId, history);
}

// ── Webhook Verification ──────────────────────────────────────────────────────

/**
 * Verifies the webhook during Meta Developer Console setup.
 *
 * Meta sends three query params:
 *   hub.mode         — must equal "subscribe"
 *   hub.verify_token — must match VERIFY_TOKEN in your env
 *   hub.challenge    — echo this back to confirm ownership
 */
export const verifyWebhook = (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Webhook Verify] Received verification request', { mode, token });

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('[Webhook Verify] ✅ Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook Verify] ⚠️  Verification failed — token mismatch or wrong mode');
  return res.status(403).json({ error: 'Forbidden: invalid verify token' });
};

// ── Incoming Message Handler ──────────────────────────────────────────────────

/**
 * Receives all incoming WhatsApp events (messages, status updates, etc.).
 *
 * Meta requires a 200 OK within ~20 s to prevent retries.
 * Processing is kicked off asynchronously after the response is sent.
 */
export const handleIncomingMessage = (req, res) => {
  // ── 1. Acknowledge immediately ───────────────────────────────────────────────
  res.status(200).json({ status: 'ok' });

  // ── 2. Validate top-level object type ───────────────────────────────────────
  const body = req.body;

  if (!body || body.object !== 'whatsapp_business_account') {
    console.warn('[Webhook POST] ⚠️  Unexpected payload object:', body?.object);
    return;
  }

  // ── 3. Process asynchronously (fire-and-forget; errors are caught inside) ───
  const entries = Array.isArray(body.entry) ? body.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      processChange(change).catch((err) =>
        console.error('[Webhook POST] ❌ Unhandled error in processChange:', err.message)
      );
    }
  }
};

// ── Change dispatcher ─────────────────────────────────────────────────────────

/**
 * Routes a single webhook change to the appropriate handler.
 * Made async so the entire pipeline (AI + Sheets + WhatsApp send) can be awaited.
 *
 * @param {{ field: string, value: object }} change
 */
async function processChange(change) {
  if (change.field !== 'messages') {
    console.log('[Webhook] Ignoring non-message change field:', change.field);
    return;
  }

  const value = change.value;
  if (!value) {
    console.warn('[Webhook] Empty change value');
    return;
  }

  // ── Status updates (delivery receipts) ───────────────────────────────────
  if (Array.isArray(value.statuses) && value.statuses.length > 0) {
    for (const status of value.statuses) {
      console.log('[Status Update]', {
        messageId:   status.id,
        status:      status.status,
        recipientId: status.recipient_id,
        timestamp:   new Date(Number(status.timestamp) * 1000).toISOString(),
      });
    }
    return;
  }

  // ── Inbound messages ──────────────────────────────────────────────────────
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    console.warn('[Webhook] No messages or statuses found in change value');
    return;
  }

  const metadata = value.metadata ?? {};
  const contact  = value.contacts?.[0] ?? {};

  for (const message of value.messages) {
    logIncomingMessage({ message, metadata, contact });
    await handleMessage({ message, contact });
  }
}

// ── Core message pipeline ─────────────────────────────────────────────────────

/**
 * Runs the full pipeline for a single inbound message:
 *   working hours check → AI call → optional Sheets write → WhatsApp reply
 *
 * @param {{ message: object, contact: object }} params
 */
async function handleMessage({ message, contact }) {
  const senderPhone = message.from; // e.g. "923001234567"
  const senderName  = contact?.profile?.name ?? 'Patient';

  // Only handle text messages for now; other types get a nudge
  if (message.type !== 'text') {
    const unsupportedMsg =
      'Abhi sirf text messages support hain. ' +
      'Apna masla ya sawaal text mein likhein, main madad karungi! 😊';
    await sendWhatsAppMessage(senderPhone, unsupportedMsg);
    return;
  }

  const userMessageText = message.text?.body?.trim();
  if (!userMessageText) return;

  // ── Working hours gate ────────────────────────────────────────────────────
  if (!isWithinWorkingHours()) {
    console.log(`[Pipeline] 🕐 Out of hours — skipping AI for ${senderPhone}`);
    const outOfHoursReply = getOutOfHoursMessage();
    await sendWhatsAppMessage(senderPhone, outOfHoursReply);
    return;
  }

  // ── AI processing ─────────────────────────────────────────────────────────
  console.log(`[Pipeline] 🤖 Routing to AI for ${senderPhone} (${senderName})`);

  try {
    // Build history with the new user turn appended
    const history = buildHistory(senderPhone, userMessageText);

    const { text: aiReply, appointmentData } = await generateResponse(
      userMessageText,
      // Pass history MINUS the just-added user turn (already in messages array)
      history.slice(0, -1)
    );

    // ── Persist appointment if AI collected all required data ──────────────
    if (appointmentData) {
      try {
        await addAppointment(appointmentData);
        console.log(`[Pipeline] 📋 Appointment saved for ${senderPhone}`);
      } catch (sheetErr) {
        // Don't block the WhatsApp reply if Sheets fails
        console.error('[Pipeline] ❌ Sheets write failed:', sheetErr.message);
      }
    }

    // ── Save assistant reply to history & send to user ─────────────────────
    saveAssistantReply(senderPhone, aiReply);
    await sendWhatsAppMessage(senderPhone, aiReply);

  } catch (err) {
    console.error(`[Pipeline] ❌ AI call failed for ${senderPhone}:`, err.message);

    // Use the user-facing fallback attached by aiService if available
    const fallbackText = err.userFacingText ??
      'Mujhe abhi ek technical masla aaya hai. ' +
      'Thodi dair baad dobara try karein ya 0300-1234567 par call karein.';

    await sendWhatsAppMessage(senderPhone, fallbackText).catch((sendErr) =>
      console.error('[Pipeline] ❌ Could not send fallback message:', sendErr.message)
    );
  }
}

// ── Debug logger (unchanged) ──────────────────────────────────────────────────

/**
 * Cleanly logs a structured incoming message for debugging.
 *
 * @param {{ message: object, metadata: object, contact: object }} params
 */
function logIncomingMessage({ message, metadata, contact }) {
  const base = {
    messageId:   message.id,
    type:        message.type,
    from:        message.from,
    senderName:  contact?.profile?.name ?? 'Unknown',
    phoneNumber: metadata?.display_phone_number,
    timestamp:   new Date(Number(message.timestamp) * 1000).toISOString(),
  };

  switch (message.type) {
    case 'text':
      console.log('[Incoming Text]', { ...base, body: message.text?.body });
      break;
    case 'image':
      console.log('[Incoming Image]', { ...base, mediaId: message.image?.id, caption: message.image?.caption });
      break;
    case 'audio':
      console.log('[Incoming Audio]', { ...base, mediaId: message.audio?.id });
      break;
    case 'interactive':
      console.log('[Incoming Interactive]', {
        ...base,
        interactiveType: message.interactive?.type,
        reply: message.interactive?.button_reply ?? message.interactive?.list_reply,
      });
      break;
    default:
      console.log('[Incoming Unknown]', { ...base, rawMessage: message });
  }
}
