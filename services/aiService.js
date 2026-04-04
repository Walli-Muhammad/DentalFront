/**
 * services/aiService.js — DeepInfra (OpenAI-compatible) integration layer
 *
 * generateResponse() takes the current user message and the conversation
 * history, calls the DeepInfra-hosted model with a strict system prompt, and returns:
 *   { text, appointmentData }
 *
 * When the AI has collected Name + Dental Problem + Preferred Time it embeds
 * a machine-readable sentinel block inside its reply:
 *   %%APPOINTMENT%%{"name":"...","dentalProblem":"...","preferredTime":"..."}%%END%%
 *
 * The caller reads `appointmentData` (non-null) as the trigger to call
 * supabaseService.saveAppointment().
 *
 * Required environment variable:
 *   DEEPINFRA_API_KEY — DeepInfra secret key
 */

import OpenAI from 'openai';

// ── DeepInfra client (singleton, OpenAI-compatible) ──────────────────────────

const openai = new OpenAI({
  apiKey:  process.env.DEEPINFRA_API_KEY,
  baseURL: 'https://api.deepinfra.com/v1/openai',
});

// ── System prompt ─────────────────────────────────────────────────────────────

/**
 * This prompt is the single source of truth for the AI's identity, scope,
 * language style, and structured-output contract with the backend.
 *
 * Design principles:
 *  • Tight role-lock  — the model may only discuss clinic topics
 *  • Hard safety rail — medical advice is explicitly prohibited
 *  • Bilingual        — natural Roman Urdu / English code-switching
 *  • Sentinel output  — JSON is embedded with unique delimiters so the
 *    parser can find it even if the model adds surrounding text
 */
const SYSTEM_PROMPT = `
You are "Sana", a warm and professional AI receptionist for **ABC Dental Clinic**.

## YOUR ONLY JOB
Help patients schedule appointments and answer general clinic FAQs.
You must NEVER go outside this scope. If asked anything unrelated, politely
redirect: "Main sirf ABC Dental Clinic ke appointments aur sawalat mein
madad kar sakti hoon."

## LANGUAGE STYLE
- Communicate naturally in Roman Urdu and English, matching the patient's mix.
- Be friendly, patient, and clear — many callers are anxious about dental visits.
- Keep messages concise; avoid walls of text.

## APPOINTMENT COLLECTION FLOW
To book an appointment you MUST gather exactly three pieces of information,
one at a time if needed. Do NOT move on until you have all three:
  1. **Patient's full name**
  2. **Dental problem / reason for visit** (e.g. toothache, checkup, filling)
  3. **Preferred time / day** (e.g. "kal subah", "Saturday afternoon")

Ask naturally — do not use a numbered list or form-like questions.
Once you have inferred all three from the conversation, confirm them back to
the patient in a friendly summary message, then immediately append the
sentinel block (see OUTPUT CONTRACT below).

## CLINIC FAQs (answer freely from these facts)
- Timings  : Monday–Saturday, 10 AM – 7 PM
- Location : Main Boulevard, Gulberg III, Lahore
- Services : General checkup, teeth cleaning, fillings, root canal,
             braces/Invisalign, whitening, extractions
- Fee      : Consultation PKR 500 (deducted from treatment cost)
- Emergency: Walk-ins welcome for severe pain

## ABSOLUTE RULES
1. NEVER provide medical diagnoses, treatment plans, or dosage advice.
   If a patient describes symptoms, acknowledge empathetically and say
   the doctor will assess properly. Example:
   "Aap ki takleef samajh aa rahi hai — doctor sahab theek se
   check karenge aur bataenge. Appoint karte hain?"

2. NEVER make up clinic information not listed above (no hallucination).
   If unsure, say "Iss baare mein main sure nahi, reception call karein:
   0300-1234567."

3. NEVER store, repeat, or process payment card / CNIC / sensitive
   personal data beyond what is needed for the appointment.

## OUTPUT CONTRACT (CRITICAL — follow EXACTLY)
When you have confirmed all three fields (name, dentalProblem, preferredTime),
append this block at the very END of your message on its own line.
Replace the placeholder values with the real data. Do NOT include it before
all three fields are confirmed:

%%APPOINTMENT%%{"name":"FULL_NAME","dentalProblem":"PROBLEM","preferredTime":"TIME"}%%END%%

Example complete reply when booking is ready:
---
Bohat shukriya, [Name]! Aap ka appointment note ho gaya hai.
📋 Naam: [Name]
🦷 Masla: [Problem]
🕐 Preferred Time: [Time]

Hum jald hi confirm karenge. Koi aur sawal?
%%APPOINTMENT%%{"name":"Ahmed Ali","dentalProblem":"Daant dard, lower left","preferredTime":"Kal subah"}%%END%%
---
`.trim();

// ── Sentinel parsing ──────────────────────────────────────────────────────────

const SENTINEL_RE = /%%APPOINTMENT%%(\{.*?\})%%END%%/s;

/**
 * Extracts the structured appointment JSON from the model's raw reply.
 * Returns the parsed object, or null if the sentinel is absent / malformed.
 *
 * @param {string} rawText
 * @returns {{ name: string, dentalProblem: string, preferredTime: string } | null}
 */
function extractAppointmentData(rawText) {
  const match = rawText.match(SENTINEL_RE);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);

    // Validate all three required fields are present and non-empty
    if (data.name && data.dentalProblem && data.preferredTime) {
      return data;
    }

    console.warn('[AIService] ⚠️  Sentinel found but fields incomplete:', data);
    return null;
  } catch {
    console.warn('[AIService] ⚠️  Sentinel found but JSON is malformed:', match[1]);
    return null;
  }
}

/**
 * Strips the sentinel block from the user-facing text so patients never see it.
 *
 * @param {string} rawText
 * @returns {string}
 */
function stripSentinel(rawText) {
  return rawText.replace(SENTINEL_RE, '').trim();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @typedef {{ role: 'user' | 'assistant', content: string }} ChatMessage
 *
 * @typedef {{ text: string, appointmentData: AppointmentData | null }} AIResponse
 *
 * @typedef {{ name: string, dentalProblem: string, preferredTime: string }} AppointmentData
 */

/**
 * Sends the current user message (with full conversation history) to
 * GPT-4o-mini and returns the AI's plain-text reply + optional structured data.
 *
 * @param {string}        userMessage  — Latest message from the WhatsApp user
 * @param {ChatMessage[]} history      — Prior turns [[{role,content}], ...]
 * @returns {Promise<AIResponse>}
 */
export async function generateResponse(userMessage, history = []) {
  if (!userMessage?.trim()) {
    throw new Error('generateResponse requires a non-empty userMessage');
  }

  // Build the message array: system → history → new user turn
  const messages = [
    { role: 'system',  content: SYSTEM_PROMPT },
    ...history,
    { role: 'user',    content: userMessage },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model:       'openai/gpt-oss-120b-Turbo',
      messages,
      temperature: 0.4,   // Low temp keeps the receptionist focused & consistent
      max_tokens:  512,   // Sufficient for a natural reply; prevents runaway output
    });

    const rawText = completion.choices[0]?.message?.content ?? '';

    console.log('[AIService] 📨 Raw model reply:', rawText);

    const appointmentData = extractAppointmentData(rawText);
    const text            = stripSentinel(rawText);

    if (appointmentData) {
      console.log('[AIService] ✅ Appointment data extracted:', appointmentData);
    }

    return { text, appointmentData };

  } catch (err) {
    // Surface OpenAI error codes for easier debugging
    const status  = err?.status;
    const code    = err?.code;
    const message = err?.message ?? 'Unknown OpenAI error';

    console.error('[AIService] ❌ OpenAI API error', { status, code, message });

    // Provide a graceful fallback message the patient will see
    const fallback =
      'Mujhe abhi kuch technical masla aa raha hai. ' +
      'Thodi dair baad dobara try karein ya 0300-1234567 par call karein.';

    // Re-throw so the caller can decide whether to surface the error upstream,
    // but attach the fallback text for the WhatsApp reply layer.
    const richError  = new Error(`OpenAI call failed: ${message}`);
    richError.userFacingText = fallback;
    richError.status         = status;
    throw richError;
  }
}
