import { looksLikeNonPlace } from '../classify';
import { CURATED_PLACES, type CuratedPlace } from '../data/curatedPlaces';
import {
  editDistance,
  fuzzyThreshold,
  normalizePlaceToken,
} from '../normalize';
import type {
  LocationResolutionContext,
  LocationResolutionResult,
  ResolvedTravelPlace,
} from '../types';
import type { TravelLocationProvider } from './contracts';

function toResolved(
  place: CuratedPlace,
  matchedText: string,
  matchType: ResolvedTravelPlace['matchType'],
  confidence: number,
): ResolvedTravelPlace {
  return {
    id: place.id,
    canonicalName: place.canonicalName,
    displayName: place.displayName,
    type: place.type,
    countryCode: place.countryCode,
    countryName: place.countryName,
    stateCode: place.stateCode,
    stateName: place.stateName,
    regionName: place.regionName,
    cityName: place.cityName,
    latitude: place.latitude,
    longitude: place.longitude,
    iataCode: place.iataCode,
    airportCodes: place.airportCodes,
    nearestAirportCodes: place.nearestAirportCodes ?? place.airportCodes,
    aliases: place.aliases,
    matchedText,
    matchType,
    confidence,
    provider: 'local',
    parentPlace: place.parent
      ? { name: place.parent.name, type: place.parent.type }
      : undefined,
  };
}

function allLabels(place: CuratedPlace): string[] {
  return [place.canonicalName, place.displayName, ...place.aliases, place.iataCode]
    .filter(Boolean)
    .map((s) => normalizePlaceToken(String(s)));
}

export function resolveLocalSync(
  query: string,
  context: LocationResolutionContext = {},
): LocationResolutionResult[] {
  const raw = query.trim();
  if (!raw || looksLikeNonPlace(raw)) return [];

  const normalised = normalizePlaceToken(raw);
  if (!normalised) return [];

  const max = context.maxResults ?? 8;
  const allowFuzzy = context.allowFuzzy !== false;
  const hits: LocationResolutionResult[] = [];

  // Exact IATA
  if (/^[a-z]{3}$/i.test(normalised)) {
    for (const place of CURATED_PLACES) {
      const codes = [
        place.iataCode,
        ...(place.airportCodes ?? []),
      ]
        .filter(Boolean)
        .map((c) => c!.toLowerCase());
      if (codes.includes(normalised)) {
        hits.push({
          place: toResolved(place, raw, 'iata', 0.99),
          score: 0.99,
        });
      }
    }
  }

  // Exact / alias
  for (const place of CURATED_PLACES) {
    const labels = allLabels(place);
    if (labels.includes(normalised)) {
      const matchType =
        place.iataCode?.toLowerCase() === normalised ? 'iata' : 'exact';
      const confidence = matchType === 'iata' ? 0.99 : 0.97;
      if (!hits.some((h) => h.place.id === place.id)) {
        hits.push({
          place: toResolved(place, raw, matchType === 'iata' ? 'iata' : 'alias', confidence),
          score: confidence,
        });
      }
    }
  }

  // Bare "Hamilton" should surface Hamilton Island as an AU travel option too
  if (normalised === 'hamilton') {
    const island = CURATED_PLACES.find((p) => p.id === 'au-hamilton-island');
    if (island && !hits.some((h) => h.place.id === island.id)) {
      hits.push({
        place: toResolved(island, raw, 'alias', 0.88),
        score: 0.88,
      });
    }
  }

  // Fuzzy
  if (allowFuzzy && hits.length === 0) {
    const threshold = fuzzyThreshold(normalised.length);
    if (threshold > 0) {
      for (const place of CURATED_PLACES) {
        let best = Number.POSITIVE_INFINITY;
        for (const label of allLabels(place)) {
          if (Math.abs(label.length - normalised.length) > threshold + 1) continue;
          best = Math.min(best, editDistance(normalised, label));
        }
        if (best <= threshold) {
          const confidence = Math.max(0.55, 0.92 - best * 0.12);
          hits.push({
            place: toResolved(place, raw, 'fuzzy', confidence),
            score: confidence,
          });
        }
      }
    }
  }

  // Role bias: prefer non-airport for destination unless query looks like airport
  const role = context.roleHint ?? context.awaitingField;
  return hits
    .sort((a, b) => {
      if (role === 'destination' || role === 'origin') {
        const aAirport = a.place.type === 'airport' ? 0 : 1;
        const bAirport = b.place.type === 'airport' ? 0 : 1;
        if (aAirport !== bAirport && !/airport/i.test(raw)) {
          return bAirport - aAirport;
        }
      }
      return b.score - a.score;
    })
    .slice(0, max);
}

export class LocalTravelLocationProvider implements TravelLocationProvider {
  readonly id = 'local';

  resolveSync(
    query: string,
    context?: LocationResolutionContext,
  ): LocationResolutionResult[] {
    return resolveLocalSync(query, context);
  }

  async resolve(
    query: string,
    context?: LocationResolutionContext,
  ): Promise<LocationResolutionResult[]> {
    return resolveLocalSync(query, context);
  }

  async autocomplete(
    query: string,
    context?: LocationResolutionContext,
  ): Promise<LocationResolutionResult[]> {
    return resolveLocalSync(query, { ...context, maxResults: 10 });
  }
}
