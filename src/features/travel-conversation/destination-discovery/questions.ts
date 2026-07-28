import type { DiscoveryCriteria, DiscoveryQuestionId } from './types';
import { criteriaRichness } from './rank';

export type DiscoveryQuestion = {
  id: DiscoveryQuestionId;
  text: string;
};

const QUESTIONS: Record<DiscoveryQuestionId, (c: DiscoveryCriteria) => string> = {
  origin_or_travel_time: (c) =>
    c.originLabel
      ? `How far are you willing to fly from ${c.originLabel}?`
      : 'Where would you be flying from, and roughly how far are you willing to travel?',
  vibe_quiet_nightlife: () =>
    'Would you prefer a quiet island pace, or somewhere with more nightlife and energy?',
  budget: () => 'What budget would you like to keep the trip within — budget, mid-range, or luxury?',
  trip_character: () =>
    'Are you looking for warm weather and beaches, nature, a city break, or a mix?',
  traveller_group: () => 'Will you be travelling as a couple, family, solo, or with friends?',
  duration: () => 'Roughly how many nights are you thinking?',
  region: () => 'Are you open to the Pacific and Asia, or would you rather stay within Australia?',
};

function missingQuestionIds(criteria: DiscoveryCriteria): DiscoveryQuestionId[] {
  const missing: DiscoveryQuestionId[] = [];
  if (!criteria.originLabel && criteria.maxTravelHours == null) {
    missing.push('origin_or_travel_time');
  } else if (criteria.originLabel && criteria.maxTravelHours == null) {
    missing.push('origin_or_travel_time');
  }
  if (!criteria.vibe && !criteria.characters.includes('nightlife')) {
    // Only ask vibe when relaxation/beach/tropical without nightlife signal
    if (
      criteria.characters.some((c) =>
        ['tropical', 'beach', 'island', 'relaxation'].includes(c),
      )
    ) {
      missing.push('vibe_quiet_nightlife');
    }
  }
  if (!criteria.budgetLevel && criteria.budgetMaxAud == null) missing.push('budget');
  if (criteria.characters.length === 0 && criteria.climate.length === 0) {
    missing.push('trip_character');
  }
  if (!criteria.travellerGroup && criteria.travellers == null) missing.push('traveller_group');
  if (criteria.durationNights == null) missing.push('duration');
  if (!criteria.regionBias && criteriaRichness(criteria) >= 3) missing.push('region');
  return missing;
}

export function questionTextFor(
  id: DiscoveryQuestionId,
  criteria: DiscoveryCriteria,
): string {
  return QUESTIONS[id](criteria);
}

/** Highest-value unanswered narrowing question; skips the last asked id when possible. */
export function pickDiscoveryQuestion(
  criteria: DiscoveryCriteria,
  lastQuestionId?: DiscoveryQuestionId,
): DiscoveryQuestion | null {
  const missing = missingQuestionIds(criteria);
  if (!missing.length) return null;

  const priority: DiscoveryQuestionId[] = [
    'origin_or_travel_time',
    'vibe_quiet_nightlife',
    'budget',
    'traveller_group',
    'duration',
    'trip_character',
    'region',
  ];

  for (const id of priority) {
    if (!missing.includes(id)) continue;
    if (id === lastQuestionId && missing.length > 1) continue;
    return { id, text: QUESTIONS[id](criteria) };
  }

  const fallback = missing.find((id) => id !== lastQuestionId) ?? missing[0]!;
  return { id: fallback, text: QUESTIONS[fallback](criteria) };
}
