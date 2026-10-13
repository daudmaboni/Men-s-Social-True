// Dates are always worked out in the man's own timezone,
// so "today" in Dar es Salaam is the right day even if a server is elsewhere.

export function userTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "2026-10-13" for the given moment, in the given timezone. */
export function dateKey(date: Date, timeZone: string = userTimeZone()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Moves a "YYYY-MM-DD" key by a number of days (safe across months and years). */
export function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** The last `n` day keys, oldest first, ending today. */
export function lastNDays(n: number, now: Date = new Date(), timeZone?: string): string[] {
  const today = dateKey(now, timeZone);
  return Array.from({ length: n }, (_, i) => shiftKey(today, i - (n - 1)));
}

/** "M", "T", "W"… for a day key. */
export function weekdayLetter(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
