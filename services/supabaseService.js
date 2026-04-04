/**
 * services/supabaseService.js — Supabase database layer
 *
 * Replaces the Google Sheets MVP with a real Postgres-backed store.
 *
 * Tables used:
 *   patients      (phone_number PK, name)
 *   messages      (id serial PK, phone_number, direction, content, created_at)
 *   appointments  (id serial PK, phone_number, patient_name, dental_problem,
 *                  preferred_time, status, created_at)
 *
 * Required environment variables:
 *   SUPABASE_URL — e.g. https://<project>.supabase.co
 *   SUPABASE_KEY — anon/service-role key
 */

import { createClient } from '@supabase/supabase-js';

// ── Singleton client ──────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── patients ──────────────────────────────────────────────────────────────────

/**
 * Ensures the patient exists in the `patients` table.
 * Uses upsert so a second message from the same number is a no-op.
 *
 * @param {string} phoneNumber — Sender's WhatsApp number (e.g. "923001234567")
 * @param {string} [name]      — Display name from WhatsApp contact profile
 * @returns {Promise<void>}
 */
export async function upsertPatient(phoneNumber, name = 'Unknown') {
  const { error } = await supabase
    .from('patients')
    .upsert(
      { phone_number: phoneNumber, name },
      { onConflict: 'phone_number', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[SupabaseService] ❌ upsertPatient failed:', error.message);
    throw new Error(`Supabase upsertPatient error: ${error.message}`);
  }

  console.log('[SupabaseService] 👤 Patient upserted:', phoneNumber);
}

// ── messages ──────────────────────────────────────────────────────────────────

/**
 * Appends a single message (inbound or outbound) to the `messages` table.
 *
 * @param {string} phoneNumber          — Related patient phone number
 * @param {'inbound' | 'outbound'} direction
 * @param {string} content              — Raw message text
 * @returns {Promise<void>}
 */
export async function logMessage(phoneNumber, direction, content) {
  const { error } = await supabase
    .from('messages')
    .insert({ phone_number: phoneNumber, direction, content });

  if (error) {
    console.error('[SupabaseService] ❌ logMessage failed:', error.message);
    throw new Error(`Supabase logMessage error: ${error.message}`);
  }

  console.log(`[SupabaseService] 💬 Message logged [${direction}] for ${phoneNumber}`);
}

// ── appointments ──────────────────────────────────────────────────────────────

/**
 * Inserts a confirmed appointment record into the `appointments` table.
 * Called when the AI sentinel protocol fires (%%APPOINTMENT%% block detected).
 *
 * @param {string} phoneNumber
 * @param {{ name: string, dentalProblem: string, preferredTime: string }} appointmentData
 * @returns {Promise<void>}
 */
export async function saveAppointment(phoneNumber, { name, dentalProblem, preferredTime }) {
  if (!name || !dentalProblem || !preferredTime) {
    throw new Error('saveAppointment: name, dentalProblem, and preferredTime are all required');
  }

  const { error } = await supabase
    .from('appointments')
    .insert({
      phone_number:    phoneNumber,
      patient_name:    name,
      dental_problem:  dentalProblem,
      preferred_time:  preferredTime,
      status:          'pending',
    });

  if (error) {
    console.error('[SupabaseService] ❌ saveAppointment failed:', error.message);
    throw new Error(`Supabase saveAppointment error: ${error.message}`);
  }

  console.log('[SupabaseService] 📋 Appointment saved for', phoneNumber, { name, dentalProblem, preferredTime });
}
