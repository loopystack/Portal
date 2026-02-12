/**
 * App uses a single fixed timezone for all members: UTC+9 (Asia/Yakutsk).
 * All "today", "current month", etc. are in this timezone.
 */
export const APP_TIMEZONE = 'Asia/Yakutsk';

/** Today's date in app timezone as YYYY-MM-DD */
export function getTodayInAppTz(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

/** Current local parts in app timezone (1-based month) */
export function getAppLocalParts(): { year: number; month: number; day: number } {
  const s = getTodayInAppTz();
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/** Format a Date for display in app timezone (date only YYYY-MM-DD) */
export function formatDateInAppTz(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

/** Format a Date for display in app timezone (date and time) */
export function formatDateTimeInAppTz(d: Date, options?: Intl.DateTimeFormatOptions): string {
  return d.toLocaleString(undefined, { timeZone: APP_TIMEZONE, ...options });
}

const UTC_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Get the UTC ISO string for the same instant that a Date represents when its
 * date/time is interpreted in Asia/Yakutsk. Use for FullCalendar select/drop/resize:
 * take the Date from the callback, get how it looks in Yakutsk, then return the
 * correct UTC so the backend stores the right moment.
 */
export function dateInAppTzToUTC(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const y = get('year');
  const m = get('month') - 1;
  const day = get('day');
  const h = get('hour');
  const min = get('minute');
  const sec = get('second');
  const utcMs = Date.UTC(y, m, day, h, min, sec, 0) - UTC_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/** Midnight Yakutsk on (y, m, d) as ISO string */
function midnightYakutskISO(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d) - UTC_OFFSET_MS).toISOString();
}

/** Get start of today in app TZ as ISO string for API */
export function getTodayStartISO(): string {
  const { year, month, day } = getAppLocalParts();
  return midnightYakutskISO(year, month, day);
}

/** Get end of today (start of next day) in app TZ as ISO string */
export function getTodayEndISO(): string {
  const { year, month, day } = getAppLocalParts();
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);
  return midnightYakutskISO(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** Weekday (0=Sun .. 6=Sat) for calendar date (y,m,d) — same globally */
function getDayOfWeek(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Start of current week (Sunday) in app TZ */
export function getWeekStartISO(): string {
  const { year, month, day } = getAppLocalParts();
  const dow = getDayOfWeek(year, month, day);
  const sun = new Date(Date.UTC(year, month - 1, day));
  sun.setUTCDate(sun.getUTCDate() - dow);
  return midnightYakutskISO(sun.getUTCFullYear(), sun.getUTCMonth() + 1, sun.getUTCDate());
}

/** End of current week (start of next week) in app TZ */
export function getWeekEndISO(): string {
  const { year, month, day } = getAppLocalParts();
  const dow = getDayOfWeek(year, month, day);
  const nextSun = new Date(Date.UTC(year, month - 1, day));
  nextSun.setUTCDate(nextSun.getUTCDate() + (7 - dow));
  return midnightYakutskISO(nextSun.getUTCFullYear(), nextSun.getUTCMonth() + 1, nextSun.getUTCDate());
}

/** Start of current month in app TZ */
export function getMonthStartISO(): string {
  const { year, month } = getAppLocalParts();
  return midnightYakutskISO(year, month, 1);
}

/** End of current month (start of next month) in app TZ */
export function getMonthEndISO(): string {
  const { year, month } = getAppLocalParts();
  return midnightYakutskISO(year, month + 1, 1);
}
