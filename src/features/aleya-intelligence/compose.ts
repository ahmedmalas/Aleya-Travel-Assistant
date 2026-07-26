import type { ClarificationResult } from './clarify';
import type { ExtractionPatch } from './extract';
import type {
  ConversationState,
  IntelligenceResult,
  RecommendationBundle,
  SearchBundle,
} from './types';

const FORBIDDEN_GENERIC =
  /tell me a little more about what you need/i;

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
  if (state.returnTimePreference) bits.push(`return ${state.returnTimePreference.value}`);
  if (state.accommodationLocation) bits.push(`stay in ${state.accommodationLocation.value}`);
  if (state.requestedServices.length) {
    bits.push(
      `services: ${state.requestedServices
        .map((s) => s.replace(/_/g, ' '))
        .join(', ')}`,
    );
  }
  return bits;
}

function formatOffers(search: SearchBundle, recommendations: RecommendationBundle): string {
  const lines: string[] = [];
  if (recommendations.primary.length) {
    lines.push('Here is a coherent planning package (mock/planning offers — not live inventory):');
    for (const offer of recommendations.primary) {
      lines.push(
        `• ${offer.service.replace(/_/g, ' ')}: ${offer.title} — ${offer.detail}${offer.priceLabel ? ` (${offer.priceLabel})` : ''}`,
      );
    }
  }
  if (recommendations.rationale.length) {
    lines.push('');
    lines.push(recommendations.rationale.join(' '));
  }
  lines.push('');
  lines.push('Say if you want me to adjust times, change hotels, or book placeholders. I will only build a full day-by-day itinerary if you ask for one.');
  return lines.join('\n');
}

export type ComposeInput = {
  patch: ExtractionPatch;
  state: ConversationState;
  clarification: ClarificationResult;
  search?: SearchBundle;
  recommendations?: RecommendationBundle;
  travellerName?: string;
  stage: IntelligenceResult['stage'];
  shouldGenerateItinerary: boolean;
};

/**
 * Compose a natural reply from conversation state — never a hardcoded city script.
 */
export function composeReply(input: ComposeInput): string {
  const { patch, state, clarification, search, recommendations, travellerName, shouldGenerateItinerary } = input;

  if (patch.isGreeting) {
    return travellerName
      ? `Hi ${travellerName}. I can help with flights, stays, cars, transfers, activities, and more — tell me where you want to go.`
      : 'Hi. I can help with flights, stays, cars, transfers, activities, and more — tell me where you want to go.';
  }
  if (patch.isThanks) {
    return 'You’re welcome. What would you like to do next?';
  }
  if (patch.isCapabilityQuestion) {
    return 'I read your full request, keep requirements across turns, clarify only what is missing, then search and compare flights, hotels, cars, transfers, activities, cruises, and more. I build itineraries only when you ask.';
  }

  if (clarification.needsClarification && clarification.questions.length) {
    const known = summarizeKnown(state);
    const lead =
      known.length > 0
        ? `I’ve captured ${known.join('; ')}.`
        : 'I’ve started capturing your travel requirements.';
    const question = clarification.questions[0]!;
    // Melbourne-style: suggest concrete Friday when we have a suggestion
    if (clarification.suggestedDate) {
      return `${lead} ${question}`;
    }
    return `${lead} ${question}`;
  }

  if (search && recommendations) {
    const known = summarizeKnown(state);
    const header = `Searching with your saved details (${known.join('; ')}).`;
    const body = formatOffers(search, recommendations);
    const itineraryNote = shouldGenerateItinerary
      ? '\n\nYou asked for an itinerary — I can generate a day-by-day plan next from these options.'
      : '';
    return `${header}\n\n${body}${itineraryNote}`;
  }

  // Soft continue when we have intent but are not searching yet
  const known = summarizeKnown(state);
  if (known.length > 0) {
    return `Got it — I’ve saved ${known.join('; ')}. Tell me anything else to refine, or confirm the remaining details so I can search.`;
  }

  // Last resort when there is truly no travel signal — still avoid the banned generic phrase
  const fallback =
    'Share a destination, dates, or the services you need (flights, hotel, car hire, and so on) and I’ll take it from there.';
  if (FORBIDDEN_GENERIC.test(fallback)) {
    return 'Share a destination or travel service and I’ll help.';
  }
  return fallback;
}
