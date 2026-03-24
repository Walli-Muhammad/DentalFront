/**
 * utils/timeUtils.js — Timezone-aware working-hours helper
 *
 * All logic is anchored to 'Asia/Karachi' (PKT, UTC+5).
 * No external date library needed — uses the Intl API built into Node ≥ 18.
 */

const TIMEZONE = 'Asia/Karachi';

// Working hours: Monday–Saturday, 10:00 AM – 8:00 PM (PKT)
const OPEN_HOUR  = 10; // 10:00 AM
const CLOSE_HOUR = 20; // 8:00 PM (exclusive — 20:00 means door closes at 20:00)

// 0 = Sunday, 1 = Mon … 6 = Sat
const WORKING_DAYS = new Set([1, 2, 3, 4, 5, 6]);

/**
 * Returns the current date-time broken down into Karachi local parts.
 *
 * @returns {{ hour: number, minute: number, dayOfWeek: number, isoString: string }}
 */
export function getKarachiTime() {
  const now = new Date();

  // Intl gives us locale parts without needing a library
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour:     'numeric',
    minute:   'numeric',
    weekday:  'short',
    hour12:   false,
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  const hour    = parseInt(get('hour'),   10);
  const minute  = parseInt(get('minute'), 10);

  // Map short weekday name → 0-indexed day number (Sun=0)
  const WEEKDAY_MAP = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = WEEKDAY_MAP[get('weekday')] ?? -1;

  return {
    hour,
    minute,
    dayOfWeek,
    isoString: now.toISOString(), // always UTC for logging
  };
}

/**
 * Returns true if the clinic is currently open for business.
 *
 * @returns {boolean}
 */
export function isWithinWorkingHours() {
  const { hour, dayOfWeek } = getKarachiTime();

  const isWorkingDay  = WORKING_DAYS.has(dayOfWeek);
  const isOpenHour    = hour >= OPEN_HOUR && hour < CLOSE_HOUR;

  return isWorkingDay && isOpenHour;
}

/**
 * Returns a friendly out-of-hours message in Roman Urdu / English.
 * Always tells the patient when the clinic reopens.
 *
 * @returns {string}
 */
export function getOutOfHoursMessage() {
  const { dayOfWeek } = getKarachiTime();
  const isSunday      = dayOfWeek === 0;

  const reopenDay = isSunday
    ? 'Kal — Monday'
    : 'Kal subah';

  return (
    `🦷 *ABC Dental Clinic*\n\n` +
    `Assalam o Alaikum! Filhaal hamare working hours khatam ho gaye hain.\n\n` +
    `⏰ *Timings:* Monday – Saturday, 10:00 AM – 8:00 PM\n\n` +
    `Aap ka message mil gaya hai. ${reopenDay} 10:00 AM par hum jawab denge. ` +
    `Agar emergency hai toh please seedha clinic aayen.\n\n` +
    `Shukriya! 🙏`
  );
}
