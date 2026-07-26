/** Place lexicon for dynamic extraction — not destination-specific response branching. */

export type PlaceRef = {
  name: string;
  aliases: string[];
  iata?: string;
};

export const PLACES: PlaceRef[] = [
  { name: 'Sydney', aliases: ['sydney', 'syd'], iata: 'SYD' },
  { name: 'Melbourne', aliases: ['melbourne', 'mel'], iata: 'MEL' },
  { name: 'Brisbane', aliases: ['brisbane', 'bne'], iata: 'BNE' },
  { name: 'Perth', aliases: ['perth', 'per'], iata: 'PER' },
  { name: 'Adelaide', aliases: ['adelaide', 'adl'], iata: 'ADL' },
  { name: 'Canberra', aliases: ['canberra', 'cbr'], iata: 'CBR' },
  { name: 'Gold Coast', aliases: ['gold coast', 'ool'], iata: 'OOL' },
  { name: 'Cairns', aliases: ['cairns', 'cns'], iata: 'CNS' },
  { name: 'Auckland', aliases: ['auckland', 'akl'], iata: 'AKL' },
  { name: 'Queenstown', aliases: ['queenstown', 'zqn'], iata: 'ZQN' },
  { name: 'Tokyo', aliases: ['tokyo', 'tyo', 'japan'], iata: 'TYO' },
  { name: 'Bali', aliases: ['bali', 'denpasar', 'dps'], iata: 'DPS' },
  { name: 'Singapore', aliases: ['singapore', 'sin'], iata: 'SIN' },
  { name: 'Bangkok', aliases: ['bangkok', 'bkk'], iata: 'BKK' },
  { name: 'London', aliases: ['london', 'lhr'], iata: 'LON' },
  { name: 'Paris', aliases: ['paris', 'cdg'], iata: 'PAR' },
  { name: 'Dubai', aliases: ['dubai', 'dxb'], iata: 'DXB' },
];

export function findPlacesInText(text: string): PlaceRef[] {
  const lower = text.toLowerCase();
  return PLACES.filter((place) =>
    place.aliases.some((alias) =>
      alias.length <= 3 ? new RegExp(`\\b${alias}\\b`, 'i').test(lower) : lower.includes(alias),
    ),
  );
}

const AREA_LEXICON: Array<{ area: string; city: string; aliases: string[] }> = [
  { area: 'Docklands', city: 'Melbourne', aliases: ['docklands'] },
  // Brisbane riverside precinct (two-word form). Melbourne CBD uses "Southbank".
  { area: 'South Bank', city: 'Brisbane', aliases: ['south bank'] },
  { area: 'Southbank', city: 'Melbourne', aliases: ['southbank'] },
  { area: 'Surfers Paradise', city: 'Gold Coast', aliases: ['surfers paradise'] },
  { area: 'Shibuya', city: 'Tokyo', aliases: ['shibuya'] },
];

export function findAreaMentions(text: string): Array<{ area: string; city: string }> {
  const lower = text.toLowerCase();
  // Prefer longer aliases first so "south bank" wins over "southbank" substring collisions.
  const ranked = [...AREA_LEXICON].sort(
    (a, b) => Math.max(...b.aliases.map((x) => x.length)) - Math.max(...a.aliases.map((x) => x.length)),
  );
  const hits: Array<{ area: string; city: string }> = [];
  for (const entry of ranked) {
    if (entry.aliases.some((alias) => lower.includes(alias))) {
      // Avoid double-matching Southbank when South Bank already matched
      if (
        hits.some(
          (h) =>
            h.area.replace(/\s+/g, '').toLowerCase() === entry.area.replace(/\s+/g, '').toLowerCase(),
        )
      ) {
        continue;
      }
      hits.push({ area: entry.area, city: entry.city });
    }
  }
  return hits;
}

/** Resolve a raw locality/area phrase to its parent city when known. */
export function matchAreaName(raw: string): { area: string; city: string } | undefined {
  const lower = raw.trim().toLowerCase();
  const exact = AREA_LEXICON.find(
    (entry) => entry.area.toLowerCase() === lower || entry.aliases.some((alias) => alias === lower),
  );
  if (exact) return { area: exact.area, city: exact.city };
  // Longer alias match first
  const ranked = [...AREA_LEXICON].sort(
    (a, b) => Math.max(...b.aliases.map((x) => x.length)) - Math.max(...a.aliases.map((x) => x.length)),
  );
  const partial = ranked.find((entry) => entry.aliases.some((alias) => lower.includes(alias)));
  return partial ? { area: partial.area, city: partial.city } : undefined;
}
