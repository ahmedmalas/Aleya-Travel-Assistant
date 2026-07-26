import type { ClarificationResult } from './clarify';
import type { ExtractionPatch } from './extract';
import type { ConversationState, IntelligenceResult } from './types';

function serviceLabel(service: string): string {
  return service.replace(/_/g, ' ');
}

function summarizeKnown(state: ConversationState): string[] {
  const bits: string[] = [];
  if (state.origin) bits.push(`origin ${state.origin.value}`);
  if (state.destination) bits.push(`destination ${state.destination.value}`);
  if (state.departureDate?.value.isoDate) {
    bits.push(`departing ${state.departureDate.value.label || state.departureDate.value.isoDate}`);
  } else if (state.departureDate) {
    bits.push(`around ${state.departureDate.value.label}`);
  }
  if (state.departureTimePreference) {
    const label =
      state.departureTimePreference.value === 'after_5pm'
        ? 'after 5pm'
        : state.departureTimePreference.value;
    bits.push(`outbound ${label}`);
  }
  if (state.returnDate?.value.label) bits.push(state.returnDate.value.label);
  else if (state.returnTimePreference) bits.push(`return ${state.returnTimePreference.value}`);
  if (state.accommodationArea) bits.push(`stay in ${state.accommodationArea.value}`);
  if (state.durationNights) {
    bits.push(`${state.durationNights.value} night${state.durationNights.value === 1 ? '' : 's'}`);
  }
  if (state.requestedServices.length) {
    bits.push(`services: ${state.requestedServices.map(serviceLabel).join(', ')}`);
  }
  if (state.travellers && state.travellers.source === 'confirmed') {
    const t = state.travellers.value;
    const parts = [`${t.adults} adult${t.adults === 1 ? '' : 's'}`];
    if (t.children) parts.push(`${t.children} child${t.children === 1 ? '' : 'ren'}`);
    if (t.infants) parts.push(`${t.infants} infant${t.infants === 1 ? '' : 's'}`);
    bits.push(parts.join(', '));
  }
  if (state.budget) {
    bits.push(
      state.budget.value.relative === 'cheaper'
        ? 'prefer cheaper options'
        : state.budget.value.style
          ? `${state.budget.value.style} budget`
          : `budget ${state.budget.value.amount ?? ''}`.trim(),
    );
  }
  if (state.airlinePreferences?.value.airlines?.length) {
    bits.push(`airline ${state.airlinePreferences.value.airlines.join(', ')}`);
  }
  if (state.hotelPreferences?.value.stars) {
    bits.push(`${state.hotelPreferences.value.stars}-star hotel preference`);
  } else if (state.hotelPreferences?.value.notes) {
    bits.push(state.hotelPreferences.value.notes);
  }
  if (state.dietaryRequirements?.value.length) {
    bits.push(`dietary: ${state.dietaryRequirements.value.join(', ')}`);
  }
  if (state.selectedOptions.length) {
    bits.push(`selected: ${state.selectedOptions.map((o) => o.label).join(', ')}`);
  }
  if (state.explicitItineraryIntent) bits.push('itinerary requested');
  return bits;
}

export type ComposeInput = {
  patch: ExtractionPatch;
  state: ConversationState;
  clarification: ClarificationResult;
  stage: IntelligenceResult['stage'];
  travellerName?: string;
};

/**
 * Acknowledge understood state and clarify when needed.
 * Never claims a search ran. Never uses banned generic fallbacks when travel intent exists.
 * Confidence scores stay internal and are never mentioned.
 */
export function composeReply(input: ComposeInput): string {
  const { patch, state, clarification, travellerName } = input;

  if (patch.isGreeting) {
    return travellerName
      ? `Hi ${travellerName}. Tell me where you want to go and I’ll capture the details.`
      : 'Hi. Tell me where you want to go and I’ll capture the details.';
  }
  if (patch.isThanks) return 'You’re welcome. What would you like to adjust next?';
  if (patch.isCapabilityQuestion) {
    return 'I read your full message, keep requirements across turns, and ask only for what is still missing. I do not invent searches or itineraries unless you ask for an itinerary.';
  }

  const known = summarizeKnown(state);

  if (clarification.needsClarification && clarification.question) {
    const lead =
      known.length > 0
        ? `I’ve got ${known.join('; ')}.`
        : 'I’ve started capturing your travel requirements.';
    return `${lead} ${clarification.question}`;
  }

  if (known.length > 0) {
    const itineraryNote = state.explicitItineraryIntent
      ? ' You’ve asked for an itinerary — I’ll generate one only when that step is available for this conversation.'
      : ' I won’t build an itinerary unless you ask for one.';
    return `Understood — I’ve saved ${known.join('; ')}.${itineraryNote} Tell me anything to add, change, or remove.`;
  }

  return 'Share a destination, dates, or the services you need (flights, accommodation, car hire, and so on) and I’ll take it from there.';
}
