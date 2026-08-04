/**
 * Relative duration reasoning — quantity × unit → day offset.
 *
 * Surface forms (after 2 weeks / in two weeks / 14 days later / a fortnight /
 * stay for 14 days) are one semantic class. This module reasons over duration
 * structure, not individual travel phrase patches.
 */

export type RelativeDurationMeaning = {
  /** Whole days to add to the temporal anchor (usually departure). */
  dayOffset: number;
  /** True when the speaker framed the duration in nights. */
  framedAsNights: boolean;
};

const WORD_QUANTITY: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
};

const UNIT_TO_DAYS: Record<string, { daysPerUnit: number; nights: boolean }> = {
  day: { daysPerUnit: 1, nights: false },
  days: { daysPerUnit: 1, nights: false },
  week: { daysPerUnit: 7, nights: false },
  weeks: { daysPerUnit: 7, nights: false },
  fortnight: { daysPerUnit: 14, nights: false },
  fortnights: { daysPerUnit: 14, nights: false },
  night: { daysPerUnit: 1, nights: true },
  nights: { daysPerUnit: 1, nights: true },
};

const QUANTITY_PATTERN =
  String.raw`(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)`;
const UNIT_PATTERN = String.raw`(days?|weeks?|nights?|fortnights?)`;
/** Optional quantity; fortnight may stand alone as one fortnight. */
const DURATION_PATTERN = String.raw`(?:${QUANTITY_PATTERN}\s+)?${UNIT_PATTERN}`;

function parseQuantity(raw: string | undefined, unit: string): number | null {
  if (raw === undefined || raw.length === 0) {
    return unit.startsWith('fortnight') ? 1 : null;
  }
  const folded = raw.trim().toLowerCase();
  if (/^\d+$/.test(folded)) {
    const n = Number(folded);
    return n > 0 && n <= 366 ? n : null;
  }
  return WORD_QUANTITY[folded] ?? null;
}

function meaningFromDurationMatch(
  quantityRaw: string | undefined,
  unitRaw: string | undefined,
): RelativeDurationMeaning | null {
  if (!unitRaw) return null;
  const unitInfo = UNIT_TO_DAYS[unitRaw];
  if (!unitInfo) return null;
  const quantity = parseQuantity(quantityRaw, unitRaw);
  if (quantity === null) return null;
  const dayOffset = quantity * unitInfo.daysPerUnit;
  if (dayOffset <= 0 || dayOffset > 366) return null;
  return {
    dayOffset,
    framedAsNights: unitInfo.nights,
  };
}

/**
 * Extract a relative duration meaning from a folded (lowercase) utterance.
 * Returns null when no duration structure is present.
 */
export function extractRelativeDurationMeaning(
  foldedMessage: string,
): RelativeDurationMeaning | null {
  const folded = foldedMessage.trim();
  if (!folded) return null;

  const frames: RegExp[] = [
    new RegExp(String.raw`\bafter\s+${DURATION_PATTERN}`),
    new RegExp(String.raw`\bin\s+${DURATION_PATTERN}`),
    new RegExp(String.raw`${DURATION_PATTERN}\s+later\b`),
    new RegExp(String.raw`\bstay(?:ing)?\s+(?:for\s+)?${DURATION_PATTERN}`),
    new RegExp(String.raw`\bfor\s+${DURATION_PATTERN}`),
    new RegExp(String.raw`^\s*${DURATION_PATTERN}\s*[.!?]?\s*$`),
  ];

  for (const frame of frames) {
    const match = folded.match(frame);
    if (!match) continue;
    const meaning = meaningFromDurationMatch(match[1], match[2]);
    if (meaning) return meaning;
  }

  return null;
}
