import {
  DISCOVERY_CATALOGUE,
  type DiscoveryCatalogueEntry,
} from './catalogue';
import type {
  DiscoveryCandidate,
  DiscoveryCriteria,
  DiscoveryMatchStrength,
} from './types';

function originCode(criteria: DiscoveryCriteria): 'SYD' | 'MEL' | 'BNE' | undefined {
  const label = (criteria.originLabel ?? '').toLowerCase();
  const code = (criteria.originAirportCode ?? '').toUpperCase();
  if (code === 'SYD' || code === 'MEL' || code === 'BNE') return code;
  if (label.includes('sydney')) return 'SYD';
  if (label.includes('melbourne')) return 'MEL';
  if (label.includes('brisbane')) return 'BNE';
  return undefined;
}

function flightHours(entry: DiscoveryCatalogueEntry, criteria: DiscoveryCriteria): number | undefined {
  const code = originCode(criteria);
  if (!code) return undefined;
  return entry.flightHoursFrom[code];
}

function isExcluded(entry: DiscoveryCatalogueEntry, criteria: DiscoveryCriteria): boolean {
  const exclusions = criteria.exclusions.map((e) => e.toLowerCase());
  if (!exclusions.length) return false;
  const hay = [
    entry.placeName,
    entry.displayName,
    entry.countryCode,
    ...entry.tags,
  ]
    .join(' ')
    .toLowerCase();
  return exclusions.some((ex) => hay.includes(ex) || ex.includes(entry.placeName.toLowerCase()));
}

function hardPass(entry: DiscoveryCatalogueEntry, criteria: DiscoveryCriteria, rejectedIds: string[]): boolean {
  if (rejectedIds.includes(entry.id)) return false;
  if (isExcluded(entry, criteria)) return false;
  if (criteria.regionBias === 'australia' && entry.region !== 'australia') return false;
  if (criteria.regionBias === 'pacific' && entry.region !== 'pacific') return false;
  if (criteria.regionBias === 'asia' && entry.region !== 'asia') return false;
  if (criteria.regionBias === 'international' && entry.region === 'australia') return false;

  const hours = flightHours(entry, criteria);
  if (criteria.maxTravelHours != null && hours != null && hours > criteria.maxTravelHours + 0.25) {
    return false;
  }

  if (criteria.budgetLevel === 'budget' && entry.budgetLevel === 'luxury') return false;
  if (criteria.budgetLevel === 'luxury' && entry.budgetLevel === 'budget') {
    // soft — allow later as compromise via scoring, not hard fail
  }

  if (criteria.travellerGroup === 'family' && !entry.familyFriendly) return false;

  // City-break vs beach-only hard preference when characters are exclusive
  const wantsCity =
    criteria.characters.includes('city') &&
    !criteria.characters.includes('beach') &&
    !criteria.characters.includes('tropical') &&
    !criteria.characters.includes('island');
  if (wantsCity && !entry.characters.includes('city')) return false;

  const wantsSnow = criteria.characters.includes('snow');
  if (wantsSnow && !entry.characters.includes('snow') && !entry.climate.includes('cool')) {
    return false;
  }

  return true;
}

function scoreEntry(
  entry: DiscoveryCatalogueEntry,
  criteria: DiscoveryCriteria,
): { score: number; reasons: string[]; tradeoffs: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const tradeoffs: string[] = [];

  const charMatches = criteria.characters.filter((c) => entry.characters.includes(c));
  if (charMatches.length) {
    score += charMatches.length * 12;
    reasons.push(`fits ${charMatches.slice(0, 3).join(', ')}`);
  }

  for (const climate of criteria.climate) {
    if (entry.climate.includes(climate as 'tropical' | 'warm' | 'temperate' | 'cool')) {
      score += 10;
      reasons.push(`${climate} climate`);
    }
  }

  if (criteria.vibe && entry.vibe === criteria.vibe) {
    score += 10;
    reasons.push(criteria.vibe === 'quiet' ? 'quieter pace' : criteria.vibe === 'lively' ? 'more energy' : 'balanced vibe');
  } else if (criteria.vibe && entry.vibe === 'mixed') {
    score += 4;
  } else if (criteria.vibe && entry.vibe !== criteria.vibe) {
    score -= 8;
    tradeoffs.push(`more ${entry.vibe} than ${criteria.vibe}`);
  }

  const hours = flightHours(entry, criteria);
  if (criteria.maxTravelHours != null && hours != null) {
    if (hours <= criteria.maxTravelHours) {
      score += 14;
      reasons.push(`about ${hours}h from ${criteria.originLabel ?? 'your origin'}`);
    }
  } else if (hours != null && hours <= 4) {
    score += 4;
  }

  if (criteria.budgetLevel) {
    if (entry.budgetLevel === criteria.budgetLevel || entry.budgetLevel === 'flexible') {
      score += 8;
      reasons.push(`${criteria.budgetLevel.replace('_', '-')} budget fit`);
    } else if (
      (criteria.budgetLevel === 'mid_range' && entry.budgetLevel !== 'luxury') ||
      (criteria.budgetLevel === 'budget' && entry.budgetLevel === 'mid_range')
    ) {
      score += 3;
      tradeoffs.push('budget is a looser fit');
    } else {
      score -= 6;
      tradeoffs.push('budget alignment is weaker');
    }
  }

  for (const activity of criteria.activities) {
    if (entry.activities.some((a) => a.includes(activity) || activity.includes(a))) {
      score += 6;
      reasons.push(`${activity} options`);
    }
  }

  if (criteria.travellerGroup === 'couple' && entry.characters.includes('romantic')) {
    score += 6;
    reasons.push('works well for couples');
  }
  if (criteria.travellerGroup === 'family' && entry.familyFriendly) {
    score += 6;
    reasons.push('family-friendly');
  }

  if (criteria.durationNights != null && criteria.durationNights <= 4 && hours != null && hours <= 5) {
    score += 5;
    reasons.push('suitable for a shorter stay');
  }

  if (entry.region === 'australia' && criteria.characters.includes('tropical')) {
    // domestic tropical is a useful compromise when international is tight
    if (criteria.maxTravelHours != null && criteria.maxTravelHours <= 6) {
      reasons.push('easier domestically within your flight window');
    }
  }

  // Deduplicate reasons
  const uniqReasons = Array.from(new Set(reasons)).slice(0, 4);
  const uniqTradeoffs = Array.from(new Set(tradeoffs)).slice(0, 2);
  return { score, reasons: uniqReasons, tradeoffs: uniqTradeoffs };
}

function strength(score: number, topScore: number): DiscoveryMatchStrength {
  if (topScore <= 0) return 'compromise';
  const ratio = score / topScore;
  if (ratio >= 0.85 && score >= 30) return 'strong';
  if (ratio >= 0.6 && score >= 18) return 'good';
  return 'compromise';
}

/** Deterministic hard-filter + soft-score ranking. */
export function rankDiscoveryCandidates(
  criteria: DiscoveryCriteria,
  rejectedIds: string[] = [],
  limit = 3,
): DiscoveryCandidate[] {
  const scored = DISCOVERY_CATALOGUE.filter((e) => hardPass(e, criteria, rejectedIds)).map((entry) => {
    const { score, reasons, tradeoffs } = scoreEntry(entry, criteria);
    return { entry, score, reasons, tradeoffs };
  });

  scored.sort((a, b) => b.score - a.score || a.entry.placeName.localeCompare(b.entry.placeName));
  const topScore = scored[0]?.score ?? 0;

  return scored.slice(0, limit).map(({ entry, score, reasons, tradeoffs }) => ({
    id: entry.id,
    placeName: entry.placeName,
    iata: entry.iata,
    score,
    reasons: reasons.length ? reasons : ['matches your stated trip style'],
    tradeoffs,
    matchStrength: strength(score, topScore),
  }));
}

export function criteriaRichness(criteria: DiscoveryCriteria): number {
  let score = 0;
  score += criteria.characters.length * 2;
  score += criteria.climate.length * 2;
  if (criteria.originLabel || criteria.originAirportCode) score += 2;
  if (criteria.maxTravelHours != null) score += 2;
  if (criteria.vibe) score += 1;
  if (criteria.budgetLevel || criteria.budgetMaxAud != null) score += 1;
  if (criteria.durationNights != null) score += 1;
  if (criteria.travellerGroup || criteria.travellers != null) score += 1;
  if (criteria.activities.length) score += 1;
  if (criteria.exclusions.length) score += 1;
  if (criteria.regionBias) score += 1;
  return score;
}

/** Recommend when enough signal exists to avoid empty generic booking ask. */
export function shouldRecommend(criteria: DiscoveryCriteria): boolean {
  const richness = criteriaRichness(criteria);
  if (richness >= 5) return true;
  if (
    criteria.characters.length > 0 &&
    (criteria.originLabel || criteria.maxTravelHours != null) &&
    richness >= 4
  ) {
    return true;
  }
  if (criteria.characters.includes('city') && criteria.durationNights != null && richness >= 3) {
    return true;
  }
  return false;
}
