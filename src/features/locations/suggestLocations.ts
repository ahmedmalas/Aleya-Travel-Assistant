import { formatAirportLabel, searchAirports } from './airports';
import type { LocationKind, LocationSuggestMode, LocationSuggestion } from './types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    state?: string;
    country?: string;
    tourism?: string;
    amenity?: string;
  };
};

function mapNominatimKind(result: NominatimResult): LocationKind {
  const type = `${result.class ?? ''} ${result.type ?? ''}`.toLowerCase();
  if (type.includes('aerodrome') || type.includes('airport')) return 'airport';
  if (type.includes('country')) return 'country';
  if (type.includes('suburb') || type.includes('neighbourhood') || type.includes('neighborhood')) {
    return 'neighbourhood';
  }
  if (type.includes('tourism') || type.includes('attraction') || type.includes('monument')) {
    return 'landmark';
  }
  if (type.includes('state') || type.includes('region') || type.includes('province')) return 'region';
  if (type.includes('city') || type.includes('town') || type.includes('village')) return 'city';
  return 'other';
}

function toAirportSuggestions(query: string): LocationSuggestion[] {
  return searchAirports(query).map((airport) => ({
    id: `airport:${airport.code}`,
    label: formatAirportLabel(airport),
    primary: `${airport.city} (${airport.code})`,
    secondary: `${airport.name}, ${airport.country}`,
    kind: 'airport' as const,
    airportCode: airport.code,
    city: airport.city,
    country: airport.country,
    source: 'airport-catalog' as const,
  }));
}

async function fetchNominatim(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
  });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-AU,en',
    },
  });
  if (!response.ok) {
    throw new Error(`Location lookup failed (${response.status})`);
  }
  const data = (await response.json()) as NominatimResult[];
  return data.map((result) => {
    const city =
      result.address?.city ||
      result.address?.town ||
      result.address?.village ||
      result.address?.suburb ||
      '';
    const country = result.address?.country || '';
    const primary =
      result.address?.tourism ||
      result.address?.amenity ||
      city ||
      result.display_name.split(',')[0]?.trim() ||
      result.display_name;
    return {
      id: `nominatim:${result.place_id}`,
      label: result.display_name,
      primary,
      secondary: [city, country].filter(Boolean).join(', ') || result.display_name,
      kind: mapNominatimKind(result),
      city: city || undefined,
      country: country || undefined,
      lat: Number(result.lat),
      lon: Number(result.lon),
      source: 'nominatim' as const,
    };
  });
}

export type SuggestLocationsOptions = {
  mode?: LocationSuggestMode;
  signal?: AbortSignal;
  /** Injected for tests. */
  fetchPlaces?: (query: string, signal?: AbortSignal) => Promise<LocationSuggestion[]>;
};

export async function suggestLocations(
  query: string,
  options: SuggestLocationsOptions = {},
): Promise<{ suggestions: LocationSuggestion[]; error: string | null }> {
  const trimmed = query.trim();
  if (trimmed.length < 1) {
    return { suggestions: [], error: null };
  }

  const mode = options.mode ?? 'any';
  const airportHits = mode === 'place' ? [] : toAirportSuggestions(trimmed);

  // Prefer airport catalog for short IATA-style queries.
  if (mode === 'flight' && /^[a-z]{1,3}$/i.test(trimmed)) {
    return { suggestions: airportHits, error: null };
  }

  let placeHits: LocationSuggestion[] = [];
  let error: string | null = null;
  if (mode !== 'flight' || trimmed.length >= 3) {
    try {
      const fetchPlaces = options.fetchPlaces ?? fetchNominatim;
      placeHits = await fetchPlaces(trimmed, options.signal);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { suggestions: airportHits, error: null };
      }
      error = err instanceof Error ? err.message : 'Location provider unavailable';
    }
  }

  const merged: LocationSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of [...airportHits, ...placeHits]) {
    const key = item.airportCode || item.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return { suggestions: merged.slice(0, 10), error };
}

export function createManualLocation(query: string): LocationSuggestion {
  const value = query.trim();
  return {
    id: `manual:${value.toLowerCase()}`,
    label: value,
    primary: value,
    secondary: 'Manual entry',
    kind: 'other',
    source: 'manual',
  };
}
