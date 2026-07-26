/** Curated place lexicon for dynamic city/airport extraction (not destination-specific branching). */

export type PlaceRef = {
  name: string;
  aliases: string[];
  iata?: string;
  country: string;
  region?: string;
};

export const PLACES: PlaceRef[] = [
  { name: 'Sydney', aliases: ['sydney', 'syd'], iata: 'SYD', country: 'AU' },
  { name: 'Melbourne', aliases: ['melbourne', 'mel', 'docklands'], iata: 'MEL', country: 'AU', region: 'Docklands' },
  { name: 'Brisbane', aliases: ['brisbane', 'bne'], iata: 'BNE', country: 'AU' },
  { name: 'Perth', aliases: ['perth', 'per'], iata: 'PER', country: 'AU' },
  { name: 'Adelaide', aliases: ['adelaide', 'adl'], iata: 'ADL', country: 'AU' },
  { name: 'Canberra', aliases: ['canberra', 'cbr'], iata: 'CBR', country: 'AU' },
  { name: 'Hobart', aliases: ['hobart', 'hba'], iata: 'HBA', country: 'AU' },
  { name: 'Gold Coast', aliases: ['gold coast', 'ool'], iata: 'OOL', country: 'AU' },
  { name: 'Cairns', aliases: ['cairns', 'cns'], iata: 'CNS', country: 'AU' },
  { name: 'Auckland', aliases: ['auckland', 'akl'], iata: 'AKL', country: 'NZ' },
  { name: 'Queenstown', aliases: ['queenstown', 'zqn'], iata: 'ZQN', country: 'NZ' },
  { name: 'Tokyo', aliases: ['tokyo', 'tyo', 'japan'], iata: 'TYO', country: 'JP' },
  { name: 'Osaka', aliases: ['osaka', 'kix'], iata: 'KIX', country: 'JP' },
  { name: 'Bali', aliases: ['bali', 'denpasar', 'dps'], iata: 'DPS', country: 'ID' },
  { name: 'Singapore', aliases: ['singapore', 'sin'], iata: 'SIN', country: 'SG' },
  { name: 'Bangkok', aliases: ['bangkok', 'bkk'], iata: 'BKK', country: 'TH' },
  { name: 'Ho Chi Minh City', aliases: ['ho chi minh', 'saigon', 'sgn', 'vietnam'], iata: 'SGN', country: 'VN' },
  { name: 'Hanoi', aliases: ['hanoi', 'han'], iata: 'HAN', country: 'VN' },
  { name: 'London', aliases: ['london', 'lhr', 'lgw'], iata: 'LON', country: 'GB' },
  { name: 'Paris', aliases: ['paris', 'cdg'], iata: 'PAR', country: 'FR' },
  { name: 'New York', aliases: ['new york', 'nyc', 'jfk'], iata: 'NYC', country: 'US' },
  { name: 'Los Angeles', aliases: ['los angeles', 'la', 'lax'], iata: 'LAX', country: 'US' },
  { name: 'Dubai', aliases: ['dubai', 'dxb'], iata: 'DXB', country: 'AE' },
  { name: 'Hong Kong', aliases: ['hong kong', 'hkg'], iata: 'HKG', country: 'HK' },
  { name: 'Fiji', aliases: ['fiji', 'nadi', 'nan'], iata: 'NAN', country: 'FJ' },
];

export function findPlacesInText(text: string): PlaceRef[] {
  const lower = text.toLowerCase();
  const found: PlaceRef[] = [];
  for (const place of PLACES) {
    if (place.aliases.some((alias) => {
      if (alias.length <= 3) {
        return new RegExp(`\\b${alias}\\b`, 'i').test(lower);
      }
      return lower.includes(alias);
    })) {
      found.push(place);
    }
  }
  return found;
}

/** Neighbourhood / area mentions that map to a city. */
export function findAreaMentions(text: string): Array<{ area: string; city: string }> {
  const lower = text.toLowerCase();
  const areas: Array<{ area: string; city: string }> = [];
  if (/\bdocklands\b/.test(lower)) areas.push({ area: 'Docklands', city: 'Melbourne' });
  if (/\bcbd\b/.test(lower) && /\bmelbourne\b/.test(lower)) areas.push({ area: 'CBD', city: 'Melbourne' });
  if (/\bsouthbank\b/.test(lower)) areas.push({ area: 'Southbank', city: 'Melbourne' });
  if (/\bsurfers paradise\b/.test(lower)) areas.push({ area: 'Surfers Paradise', city: 'Gold Coast' });
  if (/\bshibuya\b/.test(lower)) areas.push({ area: 'Shibuya', city: 'Tokyo' });
  return areas;
}
