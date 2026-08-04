/**
 * Place resolution status after TLI enrichment.
 *
 * - resolved: TLI produced a canonical match
 * - unresolved: shape-valid place kept; local TLI coverage missing
 * - ambiguous: TLI detected competing matches; user value retained
 * - null: no place set / not yet assessed
 */
export type PlaceResolutionStatus =
  | 'resolved'
  | 'unresolved'
  | 'ambiguous'
  | null;

/**
 * Deterministic place-shape gate (not a place catalogue).
 * Rejects empty / non-letter / oversized strings. Does not consult TLI.
 */
export function isShapeValidPlaceName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (/^\d+$/.test(trimmed)) return false;
  // One to four whitespace-separated tokens with optional internal hyphen/apostrophe.
  return /^[A-Za-z]+(?:['\-][A-Za-z]+)*(?:\s+[A-Za-z]+(?:['\-][A-Za-z]+)*){0,3}$/.test(
    trimmed,
  );
}
