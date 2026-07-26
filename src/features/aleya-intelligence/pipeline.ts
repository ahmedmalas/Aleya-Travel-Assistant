import { evaluateClarifications } from './clarify';
import { composeReply } from './compose';
import { extractRequirements } from './extract';
import { inferContext } from './infer';
import { mergeConversationState } from './memory';
import type { IntelligenceResult, ProcessMessageInput } from './types';
import { createEmptyConversationState } from './types';

/**
 * Phase 1 pipeline: Understand → Extract → Infer → Store → Clarify → Continue
 * No search, booking, or recommendation tools are invoked in this phase.
 */
export function processTravelMessage(input: ProcessMessageInput): IntelligenceResult {
  const now = input.now ?? new Date();
  const previous = input.previousState ?? createEmptyConversationState();

  const patch = extractRequirements(input.message, previous, now);
  let state = mergeConversationState(previous, patch);
  state = inferContext(state);

  if (patch.isDateConfirmation && state.lastSuggestedDate?.isoDate && !state.departureDate?.value.isoDate) {
    state = {
      ...state,
      awaitingDateConfirmation: false,
      departureDate: {
        value: {
          ...state.lastSuggestedDate,
          kind: 'absolute',
          isoDate: state.lastSuggestedDate.isoDate,
          label: patch.confirmedDateLabel ?? state.lastSuggestedDate.label,
        },
        source: 'confirmed',
      },
    };
  }

  if (patch.isGreeting || patch.isThanks || patch.isCapabilityQuestion) {
    return {
      stage: 'continue',
      state,
      reply: composeReply({
        patch,
        state,
        clarification: { needsClarification: false, missingRequiredFields: [] },
        stage: 'continue',
        travellerName: input.travellerName,
      }),
      clarifications: [],
      explicitItineraryIntent: state.explicitItineraryIntent,
      shouldGenerateItinerary: false,
      searchPerformed: false,
    };
  }

  const clarification = evaluateClarifications(state, now);
  state = {
    ...state,
    missingRequiredFields: clarification.missingRequiredFields,
    lastSuggestedDate: clarification.suggestedDate ?? state.lastSuggestedDate,
    awaitingDateConfirmation: Boolean(
      clarification.suggestedDate && clarification.missingRequiredFields.includes('departureDateConfirmation'),
    ),
  };

  const stage = clarification.needsClarification ? 'clarify' : 'continue';
  const reply = composeReply({
    patch,
    state,
    clarification,
    stage,
    travellerName: input.travellerName,
  });

  return {
    stage,
    state,
    reply,
    clarifications: clarification.question ? [clarification.question] : [],
    explicitItineraryIntent: state.explicitItineraryIntent,
    shouldGenerateItinerary: state.explicitItineraryIntent,
    searchPerformed: false,
  };
}
