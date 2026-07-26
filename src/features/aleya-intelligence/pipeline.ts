import { evaluateClarifications } from './clarify';
import { compareAndRecommend } from './compareRecommend';
import { composeReply } from './compose';
import { extractRequirements } from './extract';
import { inferContext } from './infer';
import { mergeConversationState } from './memory';
import { planModeFromState, routeServices } from './routing';
import { orchestrateSearch } from './searchOrchestration';
import type { IntelligenceResult, ProcessMessageInput } from './types';
import { createEmptyConversationState } from './types';

/**
 * Central Aleya Intelligence pipeline.
 * Flow: Understand → Extract → Infer → Store → Clarify → Search → Compare → Recommend → Book → Continue
 *
 * Every travel chat request must enter through `processTravelMessage`.
 */
export async function processTravelMessage(input: ProcessMessageInput): Promise<IntelligenceResult> {
  const now = input.now ?? new Date();
  const previous = input.previousState ?? createEmptyConversationState();
  const runSearch = input.runSearch !== false;

  // Understand + Extract
  const patch = extractRequirements(input.message, previous, now);

  // Store (merge) then Infer
  let state = mergeConversationState(previous, patch);
  state = inferContext(state);

  // Date confirmation path: lock suggested date as absolute
  if (patch.isDateConfirmation && state.lastSuggestedDate?.isoDate) {
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

  // Social / meta intents short-circuit without wiping travel state
  if (patch.isGreeting || patch.isThanks || patch.isCapabilityQuestion) {
    const reply = composeReply({
      patch,
      state,
      clarification: { needsClarification: false, missingRequiredFields: [], questions: [] },
      stage: 'continue',
      shouldGenerateItinerary: false,
      travellerName: input.travellerName,
    });
    return {
      stage: 'continue',
      state,
      reply,
      clarifications: [],
      itineraryRequested: state.explicitItineraryIntent,
      shouldGenerateItinerary: false,
      planModeHint: planModeFromState(state),
    };
  }

  // Clarify only when necessary
  const clarification = evaluateClarifications(state, now);
  state = {
    ...state,
    missingRequiredFields: clarification.missingRequiredFields,
    lastSuggestedDate: clarification.suggestedDate ?? state.lastSuggestedDate,
    awaitingDateConfirmation: Boolean(
      clarification.suggestedDate && clarification.missingRequiredFields.includes('departureDateConfirmation'),
    ),
  };

  if (clarification.needsClarification) {
    const reply = composeReply({
      patch,
      state,
      clarification,
      stage: 'clarify',
      shouldGenerateItinerary: false,
      travellerName: input.travellerName,
    });
    return {
      stage: 'clarify',
      state,
      reply,
      clarifications: clarification.questions,
      itineraryRequested: state.explicitItineraryIntent,
      shouldGenerateItinerary: false,
      planModeHint: planModeFromState(state),
    };
  }

  // Route → Search → Compare → Recommend
  const routed = routeServices(state);
  let search = undefined;
  let recommendations = undefined;
  let stage: IntelligenceResult['stage'] = 'continue';

  if (routed.searchReady && runSearch) {
    stage = 'search';
    search = await orchestrateSearch(state, routed.services, input.currency ?? 'AUD');
    stage = 'compare';
    recommendations = compareAndRecommend(state, search);
    stage = 'recommend';
  }

  const shouldGenerateItinerary = routed.generateItinerary;

  const reply = composeReply({
    patch,
    state,
    clarification,
    search,
    recommendations,
    stage,
    shouldGenerateItinerary,
    travellerName: input.travellerName,
  });

  return {
    stage: shouldGenerateItinerary ? 'continue' : stage,
    state,
    reply,
    clarifications: [],
    search,
    recommendations,
    itineraryRequested: state.explicitItineraryIntent,
    shouldGenerateItinerary,
    planModeHint: planModeFromState(state),
  };
}

/** Synchronous helper for tests that only assert clarify/extract behaviour. */
export async function processTravelMessageSync(input: ProcessMessageInput): Promise<IntelligenceResult> {
  return processTravelMessage({ ...input, runSearch: input.runSearch ?? false });
}
