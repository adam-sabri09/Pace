/**
 * Timezone helpers for plan generation.
 *
 * The LLM returns "wall-clock" strings in the user's IANA timezone. We use
 * Intl.DateTimeFormat to convert to UTC without pulling in a TZ library —
 * this handles DST transitions correctly because Intl consults the ICU
 * database per-instant.
 */

/**
 * Given a naive "YYYY-MM-DDTHH:MM" local wall clock and an IANA timezone,
 * return the UTC Date that produces that wall clock in that zone.
 */
export function localWallClockToUTC(
  localIsoNoOffset: string,
  timeZone: string,
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(
    localIsoNoOffset,
  );
  if (!match) {
    throw new Error(`Invalid local datetime: ${localIsoNoOffset}`);
  }
  const [, ys, ms, ds, hs, mins] = match;
  const y = +ys, m = +ms, d = +ds, h = +hs, mn = +mins;

  // Anchor: interpret the naive wall-clock as UTC first.
  const utcGuess = Date.UTC(y, m - 1, d, h, mn);
  // What wall-clock does `timeZone` see for that UTC instant?
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcGuess));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const seenAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  // The offset between `utcGuess` and what the zone displays is the
  // zone offset at that moment. Subtract it to get the "correct" UTC.
  const offsetMs = seenAsUTC - utcGuess;
  return new Date(utcGuess - offsetMs);
}

/**
 * Given a UTC Date and an IANA timezone, return the local wall-clock
 * decomposed into fields the validator uses.
 */
export function utcToLocalParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number;
  minute: number;
  minutesInDay: number;
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:MM
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const year = +p.year;
  const month = +p.month;
  const day = +p.day;
  const hour = +p.hour;
  const minute = +p.minute;
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const;
  const dayOfWeek = dow[p.weekday as keyof typeof dow];
  const dateString = `${p.year}-${p.month}-${p.day}`;
  const timeString = `${p.hour}:${p.minute}`;
  return {
    year,
    month,
    day,
    dayOfWeek,
    hour,
    minute,
    minutesInDay: hour * 60 + minute,
    dateString,
    timeString,
  };
}

/** HH:MM → total minutes-in-day. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
