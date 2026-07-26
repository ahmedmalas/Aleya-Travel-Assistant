import type { ContextCompression, ConversationState } from './types';

const COMPRESS_AFTER_TURNS = 6;

function factList(state: ConversationState): string[] {
  const facts: string[] = [];
  if (state.origin) facts.push(`origin=${state.origin.value}`);
  if (state.destination) facts.push(`destination=${state.destination.value}`);
  if (state.departureDate?.value.isoDate) facts.push(`depart=${state.departureDate.value.isoDate}`);
  else if (state.departureDate) facts.push(`depart≈${state.departureDate.value.label}`);
  if (state.returnDate?.value.isoDate) facts.push(`return=${state.returnDate.value.isoDate}`);
  else if (state.returnTimePreference) facts.push(`returnTime=${state.returnTimePreference.value}`);
  if (state.departureTimePreference) facts.push(`outbound=${state.departureTimePreference.value}`);
  if (state.accommodationArea) facts.push(`area=${state.accommodationArea.value}`);
  if (state.requestedServices.length) facts.push(`services=${state.requestedServices.join('+')}`);
  if (state.travellers) {
    const t = state.travellers.value;
    facts.push(`travellers=${t.adults}a/${t.children}c/${t.infants}i`);
  }
  if (state.budget?.value.style) facts.push(`budget=${state.budget.value.style}`);
  if (state.budget?.value.relative) facts.push(`budgetRel=${state.budget.value.relative}`);
  if (state.airlinePreferences?.value.notes) facts.push(`airlinePref=${state.airlinePreferences.value.notes}`);
  if (state.hotelPreferences?.value.notes) facts.push(`hotelPref=${state.hotelPreferences.value.notes}`);
  if (state.dietaryRequirements?.value.length) facts.push(`dietary=${state.dietaryRequirements.value.join(',')}`);
  if (state.accessibility?.value.length) facts.push(`access=${state.accessibility.value.join(',')}`);
  if (state.loyaltyMemberships?.value.length) facts.push(`loyalty=${state.loyaltyMemberships.value.join(',')}`);
  if (state.specialRequests?.value.length) facts.push(`special=${state.specialRequests.value.join(',')}`);
  if (state.selectedOptions.length) {
    facts.push(`selected=${state.selectedOptions.map((o) => o.label).join('|')}`);
  }
  if (state.explicitItineraryIntent) facts.push('itinerary=requested');
  return facts;
}

/**
 * Compress long conversation context into a structured summary.
 * Structured ConversationState remains the source of truth — this only reduces replay burden.
 */
export function compressContextIfNeeded(state: ConversationState): ConversationState {
  if (state.turnCount < COMPRESS_AFTER_TURNS) return state;

  const keyFacts = factList(state);
  const prior = state.contextCompression;
  const shouldRefresh =
    !prior ||
    state.turnCount - prior.turnCountAtCompression >= 3 ||
    prior.keyFacts.join('|') !== keyFacts.join('|');

  if (!shouldRefresh) return state;

  const summary = [
    `Trip intent after ${state.turnCount} turns:`,
    keyFacts.join('; ') || 'no structured facts yet',
  ].join(' ');

  const compression: ContextCompression = {
    summary,
    turnCountAtCompression: state.turnCount,
    keyFacts,
  };

  return {
    ...state,
    contextCompression: compression,
  };
}

export function getContextSummary(state: ConversationState): string | undefined {
  return state.contextCompression?.summary;
}
