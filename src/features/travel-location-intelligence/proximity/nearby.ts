import type { NearbyCategory, NearbyRequest, ResolvedTravelPlace } from '../types';
import { CURATED_PLACES } from '../data/curatedPlaces';
import type { LocationResolutionResult } from '../types';

const CATEGORY_TYPES: Record<NearbyCategory, ResolvedTravelPlace['type'][]> = {
  activities: ['attraction', 'beach', 'national_park', 'theme_park', 'route', 'island'],
  attractions: ['attraction', 'landmark', 'theme_park', 'national_park'],
  restaurants: ['suburb', 'neighbourhood', 'city'],
  beaches: ['beach'],
  camping: ['campground', 'national_park', 'region'],
  kayaking: ['beach', 'region', 'town'],
  four_wheel_driving: ['island', 'national_park', 'region'],
  hiking: ['national_park', 'region', 'route'],
  scenic_drives: ['route', 'region'],
  shopping: ['suburb', 'neighbourhood', 'city'],
  nightlife: ['suburb', 'neighbourhood', 'city'],
  family: ['theme_park', 'attraction', 'beach'],
  nature: ['national_park', 'island', 'region', 'beach'],
  wellness: ['resort', 'region'],
};

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Offline nearby discovery from curated catalogue using coordinates when present. */
export function findNearbyCurated(
  place: ResolvedTravelPlace,
  request: NearbyRequest,
): LocationResolutionResult[] {
  if (place.latitude == null || place.longitude == null) return [];
  const types = new Set(CATEGORY_TYPES[request.category] ?? []);
  const radius = request.radiusKm ?? 120;
  const limit = request.limit ?? 8;
  const origin = { latitude: place.latitude, longitude: place.longitude };

  return CURATED_PLACES
    .filter((p) => p.id !== place.id && types.has(p.type) && p.latitude != null && p.longitude != null)
    .map((p) => {
      const km = haversineKm(origin, { latitude: p.latitude!, longitude: p.longitude! });
      return { place: p, km };
    })
    .filter((row) => row.km <= radius)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map((row) => ({
      score: Math.max(0.4, 1 - row.km / radius),
      place: {
        id: row.place.id,
        canonicalName: row.place.canonicalName,
        displayName: row.place.displayName,
        type: row.place.type,
        countryCode: row.place.countryCode,
        countryName: row.place.countryName,
        stateCode: row.place.stateCode,
        stateName: row.place.stateName,
        regionName: row.place.regionName,
        cityName: row.place.cityName,
        latitude: row.place.latitude,
        longitude: row.place.longitude,
        iataCode: row.place.iataCode,
        airportCodes: row.place.airportCodes,
        nearestAirportCodes: row.place.nearestAirportCodes,
        aliases: row.place.aliases,
        matchedText: place.canonicalName,
        matchType: 'provider' as const,
        confidence: Math.max(0.4, 1 - row.km / radius),
        provider: 'local-nearby',
        metadata: { distanceKm: row.km, category: request.category },
      },
    }));
}
