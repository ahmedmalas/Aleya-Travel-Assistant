import type { LocationResolutionContext, LocationResolutionResult } from './types';

const MATCH_RANK: Record<string, number> = {
  exact: 100,
  alias: 95,
  iata: 98,
  contextual: 90,
  fuzzy: 70,
  provider: 75,
};

export function rankLocationResults(
  results: LocationResolutionResult[],
  context?: LocationResolutionContext,
): LocationResolutionResult[] {
  const role = context?.roleHint ?? context?.awaitingField;
  return [...results].sort((a, b) => {
    const aMatch = MATCH_RANK[a.place.matchType] ?? 50;
    const bMatch = MATCH_RANK[b.place.matchType] ?? 50;
    if (aMatch !== bMatch) return bMatch - aMatch;

    // Prefer AU for AU travel context when scores close
    if (Math.abs(a.score - b.score) < 0.05) {
      const aAu = a.place.countryCode === 'AU' ? 1 : 0;
      const bAu = b.place.countryCode === 'AU' ? 1 : 0;
      if (aAu !== bAu) return bAu - aAu;
    }

    if (role === 'destination' || role === 'origin') {
      const aApt = a.place.type === 'airport' ? 0 : 1;
      const bApt = b.place.type === 'airport' ? 0 : 1;
      if (aApt !== bApt) return bApt - aApt;
    }

    return b.score - a.score;
  });
}

export function isAmbiguousResults(results: LocationResolutionResult[]): boolean {
  if (results.length < 2) return false;
  const top = results[0]!;
  const second = results[1]!;
  // Same canonical name in different countries / states / regions / types
  if (top.place.canonicalName.toLowerCase() === second.place.canonicalName.toLowerCase()) {
    if (
      top.place.countryCode !== second.place.countryCode ||
      top.place.stateCode !== second.place.stateCode ||
      top.place.stateName !== second.place.stateName ||
      top.place.regionName !== second.place.regionName ||
      top.place.type !== second.place.type ||
      top.place.cityName !== second.place.cityName
    ) {
      return true;
    }
  }
  // Close competing scores without a clear exact winner
  if (top.score < 0.9 && second.score >= top.score - 0.08) return true;
  return false;
}
