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

export function findAreaMentions(text: string): Array<{ area: string; city: string }> {
  const lower = text.toLowerCase();
  const areas: Array<{ area: string; city: string }> = [];
  if (/\bdocklands\b/.test(lower)) areas.push({ area: 'Docklands', city: 'Melbourne' });
  if (/\bsouthbank\b/.test(lower)) areas.push({ area: 'Southbank', city: 'Melbourne' });
  if (/\bsurfers paradise\b/.test(lower)) areas.push({ area: 'Surfers Paradise', city: 'Gold Coast' });
  if (/\bshibuya\b/.test(lower)) areas.push({ area: 'Shibuya', city: 'Tokyo' });
  return areas;
}
