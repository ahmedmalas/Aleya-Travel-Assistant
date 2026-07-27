/**
 * Stage 1 — Input normalisation.
 * Tidies surface form without swapping location roles or inventing meaning.
 */
export function normalizeInput(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])(\S)/g, '$1 $2')
    // Common Australian / conversational fillers — strip only leading greeting fillers later
    .replace(/\bwanna\b/gi, 'want to')
    .replace(/\bgonna\b/gi, 'going to')
    .replace(/\bthru\b/gi, 'through')
    .trim();
}
