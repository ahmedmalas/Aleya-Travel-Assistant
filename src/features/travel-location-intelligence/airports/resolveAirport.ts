import { getDefaultLocationProvider } from '../providers/compositeProvider';
import type { LocationResolutionContext, ResolvedTravelPlace } from '../types';

export function resolveAirportSync(
  query: string,
  context: LocationResolutionContext = {},
): ResolvedTravelPlace | undefined {
  const results = getDefaultLocationProvider().resolveSync(query, {
    ...context,
    roleHint: 'airport',
    allowFuzzy: true,
  });
  const airport = results.find((r) => r.place.type === 'airport' || r.place.iataCode);
  return airport?.place;
}

export function iataCodesForPlace(place?: ResolvedTravelPlace | null): string[] {
  if (!place) return [];
  if (place.iataCode) return [place.iataCode];
  if (place.airportCodes?.length) return place.airportCodes;
  if (place.nearestAirportCodes?.length) return place.nearestAirportCodes;
  return [];
}

export function primaryIataForPlace(place?: ResolvedTravelPlace | null): string | undefined {
  return iataCodesForPlace(place)[0];
}
