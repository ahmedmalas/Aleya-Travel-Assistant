import type { LocationResolutionContext, LocationResolutionResult } from './types';
import { normalizePlaceToken } from './normalize';

type CacheEntry = {
  expiresAt: number;
  results: LocationResolutionResult[];
};

const memory = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export function locationCacheKey(
  query: string,
  context?: LocationResolutionContext,
): string {
  return [
    normalizePlaceToken(query),
    context?.countryHint ?? '',
    context?.roleHint ?? context?.awaitingField ?? '',
    context?.language ?? 'en',
  ].join('|');
}

export function getCachedLocationResults(
  query: string,
  context?: LocationResolutionContext,
): LocationResolutionResult[] | null {
  const key = locationCacheKey(query, context);
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memory.delete(key);
    return null;
  }
  return hit.results.map((r) => ({
    place: { ...r.place, aliases: [...r.place.aliases] },
    score: r.score,
  }));
}

export function setCachedLocationResults(
  query: string,
  context: LocationResolutionContext | undefined,
  results: LocationResolutionResult[],
): void {
  const key = locationCacheKey(query, context);
  memory.set(key, {
    expiresAt: Date.now() + TTL_MS,
    results: results.map((r) => ({
      place: { ...r.place, aliases: [...r.place.aliases] },
      score: r.score,
    })),
  });
}

export function clearLocationCache(): void {
  memory.clear();
}
