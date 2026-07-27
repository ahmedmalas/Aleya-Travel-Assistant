import { PLACES } from '../places';
import type { FieldValue } from '../types';
import { withConfidence } from '../confidence';

export const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12,
};

export const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};

export const PLACE_STOPWORDS = new Set([
  'around', 'from', 'to', 'on', 'at', 'in', 'and', 'with', 'for', 'next', 'this',
  'the', 'a', 'an', 'after', 'before', 'near', 'via', 'leaving', 'actually', 'instead',
  'of', 'go', 'going', 'want', 'plans', 'change', 'make', 'it',
]);

export const DESTINATION_CHANGE_STOPWORDS = new Set([
  'one', 'a', 'an', 'the', 'it', 'day', 'days', 'earlier', 'later', 'sometime', 'soon',
  'maybe', 'perhaps', 'tonight', 'today', 'tomorrow', 'yesterday', 'please', 'now',
  'of', 'go', 'going', 'to', 'want', 'plans', 'change', 'make',
]);

/** Case-sensitive place capture — avoids "instead of Melbourne" → "Of Melbourne". */
export const PLACE_CAPTURE = '([A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+)?)';

export function field<T>(value: T, source: 'confirmed' | 'inferred' = 'confirmed'): FieldValue<T> {
  return withConfidence(value, source, source === 'confirmed' ? 0.9 : 0.55);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolvePlaceName(raw: string): string {
  const cleaned = raw
    .trim()
    .split(/\s+/)
    .filter((part) => !PLACE_STOPWORDS.has(part.toLowerCase()))
    .join(' ');
  const lower = cleaned.toLowerCase();
  const known = PLACES.find((p) => p.name.toLowerCase() === lower || p.aliases.includes(lower));
  if (known) return known.name;
  const first = cleaned.split(/\s+/)[0]?.toLowerCase() ?? '';
  const byFirst = PLACES.find((p) => p.name.toLowerCase() === first || p.aliases.includes(first));
  return byFirst?.name ?? cleaned.replace(/^\w/, (c) => c.toUpperCase());
}

export function markChanged(changed: string[], ...fields: string[]): void {
  for (const f of fields) {
    if (!changed.includes(f)) changed.push(f);
  }
}
