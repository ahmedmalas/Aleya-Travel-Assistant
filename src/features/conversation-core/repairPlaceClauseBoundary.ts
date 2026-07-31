/**
 * Phase 17I — trim a repaired place capture before a following explicit
 * sibling-field clause. Does not parse or own those later fields; it only
 * stops destination/origin captures at safe boundaries.
 */

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const COUNT_TOKEN = String.raw`(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)`;
const PASSENGER_NOUN = String.raw`(?:adults?|child(?:ren)?|infants?)`;
const MONTH = String.raw`(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)`;

/**
 * Boundaries are applied longest-first so "leaving from" wins over bare "from".
 * Separators may be comma, semicolon, em/en dash, hyphen, or "and".
 */
const SEPARATOR = String.raw`(?:[,;]|[—–-]|\s)`;

const SIBLING_CLAUSE_BOUNDARIES: readonly RegExp[] = [
  new RegExp(
    String.raw`${SEPARATOR}\s*and\s+leaving\s+from\b[\s\S]*$`,
    'i',
  ),
  new RegExp(
    String.raw`${SEPARATOR}\s*and\s+departing\s+from\b[\s\S]*$`,
    'i',
  ),
  new RegExp(String.raw`${SEPARATOR}\s*and\s+from\b[\s\S]*$`, 'i'),
  new RegExp(String.raw`${SEPARATOR}\s*leaving\s+from\b[\s\S]*$`, 'i'),
  new RegExp(String.raw`${SEPARATOR}\s*departing\s+from\b[\s\S]*$`, 'i'),
  new RegExp(String.raw`${SEPARATOR}\s*leaving\s+on\b[\s\S]*$`, 'i'),
  new RegExp(String.raw`${SEPARATOR}\s*departing\s+on\b[\s\S]*$`, 'i'),
  new RegExp(String.raw`${SEPARATOR}\s*depart\s+on\b[\s\S]*$`, 'i'),
  new RegExp(String.raw`${SEPARATOR}\s*departure\s+is\b[\s\S]*$`, 'i'),
  new RegExp(String.raw`${SEPARATOR}\s*returning\s+on\b[\s\S]*$`, 'i'),
  new RegExp(String.raw`${SEPARATOR}\s*return\s+on\b[\s\S]*$`, 'i'),
  new RegExp(
    String.raw`${SEPARATOR}\s*with\s+${COUNT_TOKEN}\s+${PASSENGER_NOUN}\b[\s\S]*$`,
    'i',
  ),
  new RegExp(
    String.raw`${SEPARATOR}\s*${COUNT_TOKEN}\s+${PASSENGER_NOUN}\b[\s\S]*$`,
    'i',
  ),
  // Bare "from {origin}" after the place — after leaving/departing from.
  new RegExp(String.raw`${SEPARATOR}\s*from\b[\s\S]*$`, 'i'),
  // Trailing calendar clause still attached to an origin place capture.
  new RegExp(
    String.raw`\s+on\s+\d{1,2}\s+${MONTH}(?:\s+\d{4})?\b[\s\S]*$`,
    'i',
  ),
];

/**
 * Trim trailing sibling-field clauses from a destination/origin place capture.
 * Returns the trimmed string (may be empty); callers apply their own validation.
 */
export function trimRepairPlaceCaptureAtSiblingClause(raw: string): string {
  let value = edgeTrim(raw);
  if (value.length === 0) {
    return value;
  }
  for (const boundary of SIBLING_CLAUSE_BOUNDARIES) {
    value = value.replace(boundary, '');
    value = edgeTrim(value);
  }
  // Drop trailing clause punctuation / dashes left by separators.
  value = value.replace(/[,;:!?—–-]+$/g, '');
  value = edgeTrim(value);
  return value;
}
