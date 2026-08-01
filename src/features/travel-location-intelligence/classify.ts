import type { TravelPlaceType } from './types';

const TYPE_KEYWORDS: Array<{ type: TravelPlaceType; re: RegExp }> = [
  { type: 'airport', re: /\b(airport|intl|international|aeroport)\b/i },
  { type: 'beach', re: /\bbeach\b/i },
  { type: 'island', re: /\bisland(s)?\b/i },
  { type: 'national_park', re: /\bnational\s+park\b/i },
  { type: 'theme_park', re: /\b(disneyland|universal\s+studios|theme\s+park)\b/i },
  { type: 'ski_resort', re: /\b(ski\s+resort|ski\s+field)\b/i },
  { type: 'campground', re: /\b(campground|camping)\b/i },
  { type: 'route', re: /\b(great\s+ocean\s+road|scenic\s+(?:drive|route))\b/i },
  { type: 'port', re: /\b(cruise\s+port|marina|harbour|harbor)\b/i },
  { type: 'station', re: /\b(train\s+station|railway\s+station)\b/i },
  { type: 'resort', re: /\bresort\b/i },
];

export function classifyPlaceType(
  name: string,
  hint?: TravelPlaceType,
): TravelPlaceType {
  if (hint && hint !== 'unknown') return hint;
  for (const row of TYPE_KEYWORDS) {
    if (row.re.test(name)) return row.type;
  }
  if (/^[A-Z]{3}$/.test(name.trim())) return 'airport';
  return 'city';
}

/** Words that must never be resolved as places. */
export const NON_PLACE_TOKENS = new Set([
  'all',
  'good',
  'hotel',
  'hotels',
  'flight',
  'flights',
  'return',
  'returning',
  'ready',
  'something',
  'cheap',
  'change',
  'it',
  'please',
  'thanks',
  'thank',
  'yes',
  'yeah',
  'ok',
  'okay',
  'sure',
  'hi',
  'hello',
  'hey',
  'car',
  'hire',
  'activities',
  'activity',
  'none',
  'first',
  'second',
  'above',
]);

export function looksLikeNonPlace(query: string): boolean {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.length === 1 && NON_PLACE_TOKENS.has(tokens[0]!)) return true;
  if (tokens.every((t) => NON_PLACE_TOKENS.has(t))) return true;
  return false;
}
