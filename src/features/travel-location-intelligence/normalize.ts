/** Layered location query normalisation — candidates, not invented certainty. */

const DIACRITICS = /[\u0300-\u036f]/g;

/** Common high-confidence typographical / keyboard place fixes (pre-fuzzy). */
const PLACE_TYPO_FIXES: Array<[RegExp, string]> = [
  [/\bhmilton\b/gi, 'hamilton'],
  [/\bhmailton\b/gi, 'hamilton'],
  [/\bhamilton\s+islnd\b/gi, 'hamilton island'],
  [/\bhamilton\s+islands\b/gi, 'hamilton island'],
  [/\bgoldcoast\b/gi, 'gold coast'],
  [/\bsurfer\s+paradise\b/gi, 'surfers paradise'],
  [/\bcains\b/gi, 'cairns'],
  [/\bmelborne\b/gi, 'melbourne'],
  [/\bsidney\b/gi, 'sydney'],
  [/\bsydny\b/gi, 'sydney'],
  [/\bnewyork\b/gi, 'new york'],
  [/\blos\s+angles\b/gi, 'los angeles'],
  [/\bparris\b/gi, 'paris'],
  [/\bk'?gari\b/gi, 'kgari'],
  [/\bdockland\b/gi, 'docklands'],
  [/\bsouthbank\b/gi, 'south bank'],
];

export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '');
}

export function normalizeLocationQuery(raw: string): string {
  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

  text = stripDiacritics(text);

  for (const [re, repl] of PLACE_TYPO_FIXES) {
    text = text.replace(re, repl);
  }

  text = text
    .replace(/\bislands\b/gi, 'island')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

export function normalizePlaceToken(raw: string): string {
  return normalizeLocationQuery(raw)
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[.!?,'"]+$/g, '')
    .replace(/^[.!?,'"]+/g, '')
    .trim();
}

/** Levenshtein distance for controlled fuzzy matching. */
export function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array<number>(t.length + 1);
  const curr = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j += 1) prev[j] = j;
  for (let i = 1; i <= s.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j += 1) prev[j] = curr[j]!;
  }
  return prev[t.length]!;
}

export function fuzzyThreshold(queryLength: number): number {
  if (queryLength <= 3) return 0;
  if (queryLength <= 5) return 1;
  if (queryLength <= 8) return 2;
  return 3;
}
