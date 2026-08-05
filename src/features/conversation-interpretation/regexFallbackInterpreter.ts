import { extractConversationState } from '../conversation-core/extractConversationState';
import type { ConversationCoreState } from '../conversation-core';
import {
  emptySemanticInterpretation,
  type TravelSemanticInterpretation,
} from './schema';

/**
 * Regex extractor stack demoted to fallback-only interpretation.
 * Maps ConversationStateUpdate into the semantic schema for a uniform pipeline.
 */
export function interpretWithRegexFallback(input: {
  message: string;
  currentState: ConversationCoreState;
}): TravelSemanticInterpretation {
  const { stateUpdate } = extractConversationState({
    message: input.message,
    currentState: input.currentState,
  });

  const semantic = emptySemanticInterpretation();
  let any = false;

  const assign = <K extends keyof TravelSemanticInterpretation>(
    key: K,
    value: TravelSemanticInterpretation[K] | undefined,
  ) => {
    if (value !== undefined) {
      semantic[key] = value;
      any = true;
    }
  };

  assign('destination', stateUpdate.destination ?? null);
  assign('origin', stateUpdate.origin ?? null);
  assign('departureDate', stateUpdate.departureDate ?? null);
  assign('returnDate', stateUpdate.returnDate ?? null);
  assign('adultCount', stateUpdate.adultCount ?? null);
  assign('childCount', stateUpdate.childCount ?? null);
  assign('infantCount', stateUpdate.infantCount ?? null);
  assign('flightsRequested', stateUpdate.flightsRequested ?? null);
  assign('accommodationRequested', stateUpdate.accommodationRequested ?? null);
  assign('carHireRequested', stateUpdate.carHireRequested ?? null);
  assign('activitiesRequested', stateUpdate.activitiesRequested ?? null);
  assign('restaurantsRequested', stateUpdate.restaurantsRequested ?? null);
  assign('restaurantPreference', stateUpdate.restaurantPreference ?? null);

  if (!any) {
    semantic.intent = 'unknown';
    semantic.confidence = 0;
    return semantic;
  }

  semantic.intent = 'provide_info';
  semantic.confidence = 0.5;
  return semantic;
}
