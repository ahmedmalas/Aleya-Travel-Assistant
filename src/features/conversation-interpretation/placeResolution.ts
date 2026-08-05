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
  // Require at least one letter (Latin or other scripts); reject digit-only.
  if (!/\p{L}/u.test(trimmed)) return false;
  if (/^\d+$/.test(trimmed)) return false;
  // One to four whitespace-separated tokens with optional internal hyphen/apostrophe.
  // Unicode letters allowed so names like Bogotá are shape-valid without a catalogue.
  return /^[\p{L}]+(?:['\-][\p{L}]+)*(?:\s+[\p{L}]+(?:['\-][\p{L}]+)*){0,3}$/u.test(
    trimmed,
  );
}
