import { classifyPlaceType, looksLikeNonPlace } from '../classify';
import { normalizePlaceToken } from '../normalize';
import type {
  LocationResolutionContext,
  LocationResolutionResult,
  ResolvedTravelPlace,
} from '../types';
import type { TravelLocationProvider } from './contracts';

/**
 * Remote geocoder adapter — Open-Meteo Geocoding API (no API key / no secrets).
 * Configurable override: VITE_LOCATION_GEOCODER_URL (public endpoint only).
 * Failures return [] and never throw into conversation state.
 */
function geocoderBaseUrl(): string {
  const configured = (import.meta.env.VITE_LOCATION_GEOCODER_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'https://geocoding-api.open-meteo.com/v1/search';
}

export function isRemoteLocationProviderEnabled(): boolean {
  const flag = (import.meta.env.VITE_LOCATION_REMOTE_ENABLED as string | undefined)?.trim();
  if (flag === '0' || flag === 'false') return false;
  return true;
}

type OpenMeteoHit = {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  admin1?: string;
  timezone?: string;
  feature_code?: string;
};

function mapFeatureCode(code?: string): ResolvedTravelPlace['type'] {
  if (!code) return 'city';
  if (code.startsWith('AIRP')) return 'airport';
  if (code.startsWith('ISL')) return 'island';
  if (code.startsWith('PPLX') || code.startsWith('PPL')) return 'city';
  if (code.startsWith('ADM1')) return 'state';
  if (code.startsWith('ADM')) return 'region';
  if (code.startsWith('PRK')) return 'national_park';
  return classifyPlaceType(code);
}

function toResult(hit: OpenMeteoHit, matchedText: string): LocationResolutionResult {
  const type = mapFeatureCode(hit.feature_code);
  const id = `remote-${hit.id ?? `${hit.name}-${hit.latitude}`}`;
  const place: ResolvedTravelPlace = {
    id,
    canonicalName: hit.name,
    displayName: hit.admin1 ? `${hit.name}, ${hit.admin1}` : hit.name,
    type,
    countryCode: hit.country_code?.toUpperCase(),
    countryName: hit.country,
    stateName: hit.admin1,
    latitude: hit.latitude,
    longitude: hit.longitude,
    timezone: hit.timezone,
    aliases: [hit.name.toLowerCase()],
    matchedText,
    matchType: 'provider',
    confidence: 0.8,
    provider: 'open-meteo',
  };
  return { place, score: 0.8 };
}

export class RemoteTravelLocationProvider implements TravelLocationProvider {
  readonly id = 'remote-open-meteo';

  async resolve(
    query: string,
    context: LocationResolutionContext = {},
  ): Promise<LocationResolutionResult[]> {
    if (!isRemoteLocationProviderEnabled()) return [];
    const raw = query.trim();
    if (!raw || looksLikeNonPlace(raw)) return [];
    const normalised = normalizePlaceToken(raw);
    if (normalised.length < 2) return [];

    try {
      const url = new URL(geocoderBaseUrl());
      if (!url.searchParams.has('name')) {
        url.searchParams.set('name', normalised);
      }
      url.searchParams.set('count', String(context.maxResults ?? 6));
      url.searchParams.set('language', context.language ?? 'en');
      if (context.countryHint) {
        url.searchParams.set('countryCode', context.countryHint);
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as { results?: OpenMeteoHit[] };
      const results = payload.results ?? [];
      return results.map((hit) => toResult(hit, raw));
    } catch {
      return [];
    }
  }
}
