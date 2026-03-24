/**
 * services/sheetsService.js — Google Sheets MVP "database" layer
 *
 * Authenticates via a Google Service Account and appends a new appointment
 * row to a designated Google Sheet.
 *
 * Required environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — full JSON key file content (stringified)
 *   GOOGLE_SHEET_ID              — the spreadsheet ID from its URL
 *   GOOGLE_SHEET_TAB             — sheet tab name (default: "Appointments")
 */

import { google } from 'googleapis';

// ── Constants ─────────────────────────────────────────────────────────────────

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Columns (in order): Timestamp | Name | Dental Problem | Preferred Time
const SHEET_TAB   = process.env.GOOGLE_SHEET_TAB ?? 'Appointments';
const SHEET_RANGE = `${SHEET_TAB}!A:D`;

// ── Auth helper ───────────────────────────────────────────────────────────────

/**
 * Builds an authenticated Google Sheets client from the service account
 * credentials stored as a JSON string in the environment.
 *
 * @returns {import('googleapis').sheets_v4.Sheets}
 * @throws {Error} if the env variable is missing or malformed JSON
 */
function getSheetsClient() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!rawJson) {
    throw new Error(
      'Missing environment variable: GOOGLE_SERVICE_ACCOUNT_JSON'
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(rawJson);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. ' +
      'Ensure the env var contains the raw key file content, not a file path.'
    );
  }

  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  return google.sheets({ version: 'v4', auth });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Appends a patient appointment as a new row in the Google Sheet.
 *
 * Row layout:
 *   Column A: Booking timestamp (ISO 8601, UTC)
 *   Column B: Patient name
 *   Column C: Dental problem / reason for visit
 *   Column D: Preferred appointment time (as provided by patient)
 *
 * @param {{ name: string, dentalProblem: string, preferredTime: string }} appointmentData
 * @returns {Promise<{ success: boolean, updatedRange: string | undefined }>}
 */
export async function addAppointment({ name, dentalProblem, preferredTime }) {
  // ── Input validation ────────────────────────────────────────────────────────
  if (!name || !dentalProblem || !preferredTime) {
    throw new Error(
      'addAppointment requires name, dentalProblem, and preferredTime'
    );
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('Missing environment variable: GOOGLE_SHEET_ID');
  }

  // ── Build the row ───────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString(); // e.g. 2026-03-24T08:52:58.000Z
  const row       = [timestamp, name, dentalProblem, preferredTime];

  // ── Append to sheet ─────────────────────────────────────────────────────────
  try {
    const sheets   = getSheetsClient();
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:          SHEET_RANGE,
      valueInputOption: 'USER_ENTERED', // lets Sheets parse dates/numbers
      insertDataOption: 'INSERT_ROWS',  // always adds a fresh row; never overwrites
      requestBody: {
        values: [row],
      },
    });

    const updatedRange = response.data.updates?.updatedRange;

    console.log('[SheetsService] ✅ Appointment appended', {
      name,
      dentalProblem,
      preferredTime,
      timestamp,
      updatedRange,
    });

    return { success: true, updatedRange };

  } catch (err) {
    // Distinguish Google API errors (with a response body) from network errors
    const isApiError = !!err.response;

    if (isApiError) {
      const status  = err.response.status;
      const message = err.response.data?.error?.message ?? err.message;

      // 429 = quota / rate-limit exceeded
      if (status === 429) {
        console.error(
          '[SheetsService] ⚠️  Google Sheets rate limit hit. ' +
          'Consider adding exponential back-off for production.',
          { status, message }
        );
      } else {
        console.error('[SheetsService] ❌ Google API error', { status, message });
      }

      throw new Error(`Google Sheets API error (${status}): ${message}`);
    }

    // Network / DNS / timeout errors
    console.error('[SheetsService] ❌ Network error writing to Sheets:', err.message);
    throw new Error(`Network error writing to Google Sheets: ${err.message}`);
  }
}
