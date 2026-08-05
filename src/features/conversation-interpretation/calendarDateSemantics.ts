/**
 * Shared calendar-date meaning — single capability for production offline
 * interpretation and governed architecture semantic interpretation.
 *
 * Resolves explicit calendar expressions (ordinal/month, month/day) to ISO
 * dates using "now" for year rollover. Not a transcript catalogue.
 */

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

const MONTH_MAP: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/**
 * Resolve an explicit calendar date in the message to YYYY-MM-DD, or null.
 */
export function resolveCalendarDateIso(
  message: string,
  now: Date,
): string | null {
  const folded = asciiFold(message);
  const ordinal = folded.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/,
  );
  const alt = folded.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  let day: number | null = null;
  let month: number | null = null;
  if (ordinal) {
    day = Number(ordinal[1]);
    month = MONTH_MAP[ordinal[2] ?? ''] ?? null;
  } else if (alt) {
    month = MONTH_MAP[alt[1] ?? ''] ?? null;
    day = Number(alt[2]);
  }
  if (day === null || month === null || day < 1 || day > 31) return null;

  let year = now.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    year += 1;
  }
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}
