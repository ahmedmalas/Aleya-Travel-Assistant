/** Place / calendar lexicon — specification data only (airport codes, names). */

import {
  getDefaultLocationProvider,
  primaryIataForPlace,
} from '../travel-location-intelligence';

export type PlaceRef = { name: string; aliases: string[]; iata?: string };

export const PLACES: PlaceRef[] = [
  { name: 'Sydney', aliases: ['sydney', 'syd'], iata: 'SYD' },
  { name: 'Melbourne', aliases: ['melbourne', 'mel'], iata: 'MEL' },
  { name: 'Brisbane', aliases: ['brisbane', 'bne'], iata: 'BNE' },
  { name: 'Perth', aliases: ['perth', 'per'], iata: 'PER' },
  { name: 'Adelaide', aliases: ['adelaide', 'adl'], iata: 'ADL' },
  { name: 'Canberra', aliases: ['canberra', 'cbr'], iata: 'CBR' },
  { name: 'Gold Coast', aliases: ['gold coast', 'the gold coast', 'ool'], iata: 'OOL' },
  { name: 'Cairns', aliases: ['cairns', 'cns'], iata: 'CNS' },
  {
    name: 'Hamilton Island',
    aliases: ['hamilton island', 'hamilton islands', 'hamilton', 'htl'],
    iata: 'HTI',
  },
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

const AREAS: Array<{ area: string; city: string; aliases: string[] }> = [
  { area: 'Surfers Paradise', city: 'Gold Coast', aliases: ['surfers paradise'] },
  { area: 'Docklands', city: 'Melbourne', aliases: ['docklands'] },
  { area: 'South Bank', city: 'Brisbane', aliases: ['south bank'] },
  { area: 'Southbank', city: 'Melbourne', aliases: ['southbank'] },
  { area: 'Shibuya', city: 'Tokyo', aliases: ['shibuya'] },
];

export const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
  april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
  august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

export const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

export const MONTH_PATTERN =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

export const WEEKDAY_PATTERN = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday';

export function resolvePlaceName(raw: string): string | undefined {
  const lower = raw.trim().toLowerCase().replace(/^the\s+/, '');
  const hit = PLACES.find(
    (p) => p.name.toLowerCase() === lower || p.aliases.some((a) => a === lower || a === `the ${lower}`),
  );
  return hit?.name;
}

export function matchArea(raw: string): { area: string; city: string } | undefined {
  const lower = raw.trim().toLowerCase();
  return AREAS.find(
    (a) => a.area.toLowerCase() === lower || a.aliases.some((alias) => alias === lower),
  );
}

export function findAreasInText(text: string): Array<{ area: string; city: string; index: number }> {
  const lower = text.toLowerCase();
  const hits: Array<{ area: string; city: string; index: number }> = [];
  for (const a of AREAS) {
    for (const alias of a.aliases) {
      const index = lower.indexOf(alias);
      if (index >= 0) hits.push({ area: a.area, city: a.city, index });
    }
  }
  return hits.sort((x, y) => x.index - y.index);
}

export function iataForPlace(name?: string): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  const legacy = PLACES.find((p) => p.name.toLowerCase() === lower)?.iata;
  if (legacy) return legacy;
  const hit = getDefaultLocationProvider().resolveSync(name, { allowFuzzy: false })[0]?.place;
  return primaryIataForPlace(hit) ?? hit?.nearestAirportCodes?.[0];
}

/** Longest-first place capture group for cue patterns. */
export function placeCapturePattern(): string {
  const aliases = PLACES.flatMap((p) => [p.name, ...p.aliases])
    .map((a) => a.replace(/^the\s+/i, ''))
    .sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `(?:the\\s+)?(${aliases.join('|')})`;
}
