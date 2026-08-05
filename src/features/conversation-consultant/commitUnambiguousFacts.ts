import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from '../conversation-core';
import { emptySemanticInterpretation } from '../conversation-interpretation/schema';
import { validateAndMapSemanticInterpretation } from '../conversation-interpretation/validateAndMap';
import { canonicalizeSemanticPlaces } from '../conversation-interpretation/canonicalizePlaces';
import { buildTripLegsFromStops } from '../conversation-interpretation/tripStructureSemantics';
import type { SituationFacts, SituationModel } from './types';

/**
 * Map SituationModel → validated ConversationStateUpdate.
 * Prefer the clarify-before-write filtered proposedUpdate from interpretation.
 * Only unambiguous facts are committed.
 */
export function commitUnambiguousFacts(input: {
  situation: SituationModel;
  currentState: ConversationCoreState;
  /** Clarification to persist when the act is clarify. */
  openClarification?: ConversationStateUpdate['openClarification'];
}): ConversationStateUpdate {
  const proposed = input.situation.proposedUpdate;
  let stateUpdate: ConversationStateUpdate = { ...proposed };

  // Clarification answers may carry place facts that still need TLI/legs mapping.
  const needsPlaceRemap =
    stateUpdate.origin !== undefined ||
    stateUpdate.destination !== undefined ||
    stateUpdate.destinationStops !== undefined ||
    stateUpdate.tripStructure !== undefined;

  if (needsPlaceRemap && input.situation.intent === 'clarify_answer') {
    const semantic = emptySemanticInterpretation();
    semantic.intent = 'provide_info';
    semantic.confidence = Math.max(input.situation.confidence, 0.6);
    if (typeof stateUpdate.origin === 'string') {
      semantic.origin = stateUpdate.origin;
    }
    if (typeof stateUpdate.destination === 'string') {
      semantic.destination = stateUpdate.destination;
    }
    if (Array.isArray(stateUpdate.destinationStops)) {
      semantic.destinationStops = stateUpdate.destinationStops;
    }
    if (
      stateUpdate.tripStructure === 'one_way' ||
      stateUpdate.tripStructure === 'return' ||
      stateUpdate.tripStructure === 'multi_city'
    ) {
      semantic.tripStructure = stateUpdate.tripStructure;
    }
    const canonicalized = canonicalizeSemanticPlaces(semantic);
    const mapped = validateAndMapSemanticInterpretation(
      canonicalized.semantic,
      input.currentState,
    );
    stateUpdate = {
      ...stateUpdate,
      ...mapped.stateUpdate,
    };
  }

  if (input.situation.facts.openClarification === null) {
    stateUpdate.openClarification = null;
  }
  if (input.openClarification !== undefined) {
    stateUpdate.openClarification = input.openClarification;
  }

  // Ensure legs rebuild when origin/stops committed via clarification.
  if (
    stateUpdate.origin !== undefined ||
    stateUpdate.destinationStops !== undefined
  ) {
    const origin =
      stateUpdate.origin !== undefined
        ? stateUpdate.origin
        : input.currentState.origin;
    const stops =
      stateUpdate.destinationStops !== undefined
        ? stateUpdate.destinationStops
        : input.currentState.destinationStops;
    if (stops && stops.length > 0) {
      stateUpdate.tripLegs = buildTripLegsFromStops({
        origin,
        destinationStops: stops,
        departureDate:
          stateUpdate.departureDate !== undefined
            ? stateUpdate.departureDate
            : input.currentState.departureDate,
      });
    }
  }

  return stateUpdate;
}

export function mergeFactsPreview(
  state: ConversationCoreState,
  facts: SituationFacts,
): ConversationCoreState {
  return {
    ...state,
    origin: facts.origin !== undefined ? facts.origin : state.origin,
    destination:
      facts.destination !== undefined ? facts.destination : state.destination,
    destinationStops:
      facts.destinationStops !== undefined
        ? facts.destinationStops
        : state.destinationStops,
    tripStructure:
      facts.tripStructure !== undefined
        ? facts.tripStructure
        : state.tripStructure,
    departureDate:
      facts.departureDate !== undefined
        ? facts.departureDate
        : state.departureDate,
    returnDate:
      facts.returnDate !== undefined ? facts.returnDate : state.returnDate,
    adultCount:
      facts.adultCount !== undefined ? facts.adultCount : state.adultCount,
    childCount:
      facts.childCount !== undefined ? facts.childCount : state.childCount,
    infantCount:
      facts.infantCount !== undefined ? facts.infantCount : state.infantCount,
    conversationComplete:
      facts.conversationComplete !== undefined
        ? facts.conversationComplete
        : state.conversationComplete,
    searchExecutionRequested:
      facts.searchExecutionRequested !== undefined
        ? facts.searchExecutionRequested
        : state.searchExecutionRequested,
    openClarification:
      facts.openClarification !== undefined
        ? facts.openClarification
        : state.openClarification,
  };
}
