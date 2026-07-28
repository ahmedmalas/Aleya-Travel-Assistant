import { getDefaultLocationProvider } from './providers/compositeProvider';
import type {
  LocationResolutionContext,
  LocationResolutionResult,
  ResolvedTravelPlace,
} from './types';

/** Sync resolution via the default composite provider (local + cache). */
export function resolveSync(
  query: string,
  context?: LocationResolutionContext,
): {
  candidates: LocationResolutionResult[];
  best: ResolvedTravelPlace | undefined;
  ambiguityDetected: boolean;
} {
  const candidates = getDefaultLocationProvider().resolveSync(query, context);
  const top = candidates[0];
  const second = candidates[1];
  const ambiguityDetected = Boolean(
    top &&
      second &&
      (top.place.canonicalName.toLowerCase() === second.place.canonicalName.toLowerCase()
        ? top.place.countryCode !== second.place.countryCode ||
          top.place.regionName !== second.place.regionName
        : top.score < 0.9 && second.score >= top.score - 0.08),
  );
  return {
    candidates,
    best: ambiguityDetected ? undefined : top?.place,
    ambiguityDetected,
  };
}

/** Async resolution with remote enrichment when local is insufficient. */
export async function resolveAsync(
  query: string,
  context?: LocationResolutionContext,
): Promise<LocationResolutionResult[]> {
  return getDefaultLocationProvider().resolve(query, context);
}
