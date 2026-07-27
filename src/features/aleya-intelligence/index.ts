/**
 * Aleya Intelligence Layer (Phase 1 + Phase 2)
 * All travel chat UIs must call `handleTravelChatMessage`.
 * Live sessions commit into the canonical store — the single source of truth
 * for extraction, memory, clarification, UI summary, and search projection.
 */

export { processTravelMessage } from './pipeline';
export { createEmptyConversationState } from './types';
export { getContextSummary } from './compress';
export {
  getCanonicalTravelState,
  resetCanonicalTravelState,
  setCanonicalTravelState,
  subscribeCanonicalTravelState,
  useCanonicalTravelState,
} from './canonicalStore';
export {
  projectRequirementsSummary,
  projectSearchForm,
  summarizeKnownFromProjection,
} from './projectors';
export type { RequirementsSummaryView, SearchFormProjection } from './projectors';
export type {
  ApproximateDate,
  ConversationState,
  ContextCompression,
  FieldValue,
  IntelligenceResult,
  PresentedOption,
  ProcessMessageInput,
  TravelServiceKind,
  TripPurposeKind,
} from './types';

import {
  getCanonicalTravelState,
  setCanonicalTravelState,
} from './canonicalStore';
import { processTravelMessage } from './pipeline';
import type { ConversationState, IntelligenceResult, ProcessMessageInput } from './types';

/**
 * Live chat entrypoint. Always merges against the canonical store unless the
 * caller supplies an explicit previousState (tests / isolated simulations).
 * The resulting state is committed back to the store so UI summary, clarify,
 * and search forms cannot diverge.
 */
export function handleTravelChatMessage(input: ProcessMessageInput): IntelligenceResult {
  const previousState =
    input.previousState !== undefined ? input.previousState : getCanonicalTravelState();
  const result = processTravelMessage({ ...input, previousState });
  setCanonicalTravelState(result.state);
  return result;
}

export function continueTravelConversation(
  message: string,
  previousState: ConversationState | undefined,
  options?: Omit<ProcessMessageInput, 'message' | 'previousState'>,
): IntelligenceResult {
  return handleTravelChatMessage({ message, previousState, ...options });
}
