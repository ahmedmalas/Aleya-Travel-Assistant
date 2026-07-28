/**
 * Stage 1 — Input normalisation.
 * Tidies surface form and common misspellings without inventing travel meaning.
 */
export function normalizeInput(raw: string): string {
  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])(\S)/g, '$1: $2'.replace(': ', ' '))
    .replace(/\bwanna\b/gi, 'want to')
    .replace(/\bgonna\b/gi, 'going to')
    .replace(/\bthru\b/gi, 'through')
    .trim();

  const spelling: Array<[RegExp, string]> = [
    [/\baccomodation\b/gi, 'accommodation'],
    [/\baccomodations\b/gi, 'accommodations'],
    [/\bneer\b/gi, 'near'],
    [/\bsomthing\b/gi, 'something'],
    [/\bsomethin\b/gi, 'something'],
    [/\bexspensive\b/gi, 'expensive'],
    [/\bexpencive\b/gi, 'expensive'],
    [/\bluxry\b/gi, 'luxury'],
    [/\bhotell?\b/gi, 'hotel'],
    [/\bdockland\b/gi, 'Docklands'],
    [/\bsydny\b/gi, 'Sydney'],
    [/\bmelborne\b/gi, 'Melbourne'],
    [/\bgoldcoast\b/gi, 'Gold Coast'],
    [/\bhmilton\s+islands?\b/gi, 'Hamilton Island'],
    [/\bhmailton\s+islands?\b/gi, 'Hamilton Island'],
    [/\bhamilton\s+islands\b/gi, 'Hamilton Island'],
    [/\bchnage\b/gi, 'change'],
    [/\bned\b/gi, 'need'],
    [/\bactvities\b/gi, 'activities'],
    [/\bcar\s+hire\d+\b/gi, 'car hire'],
  ];
  for (const [re, repl] of spelling) {
    text = text.replace(re, repl);
  }

  // Canonicalise explicit destination replacement into the existing destination cue.
  text = text
    .replace(/\b(?:change|switch)\s+it\s+the\s+destination\s+to\b/gi, 'go to')
    .replace(/\b(?:change|switch)\s+(?:the\s+)?destination\s+to\b/gi, 'go to')
    .replace(/\b(?:change|switch)\s+it\s+to\b/gi, 'go to');

  return text;
}
