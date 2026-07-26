/**
 * Aleya Intelligence Layer — public entry points.
 * All travel chat UIs must call `processTravelMessage` / `handleTravelChatMessage`.
 */

export { processTravelMessage, processTravelMessageSync } from './pipeline';
export { createEmptyConversationState } from './types';
export type {
  ApproximateDate,
  ConversationState,
  FieldValue,
  IntelligenceResult,
  OfferSummary,
  ProcessMessageInput,
  RecommendationBundle,
  SearchBundle,
  TravelServiceKind,
  TripPurposeKind,
} from './types';

import { processTravelMessage } from './pipeline';
import type { ConversationState, IntelligenceResult, ProcessMessageInput } from './types';

/** Alias used by UI surfaces — every travel chat request enters here. */
export async function handleTravelChatMessage(input: ProcessMessageInput): Promise<IntelligenceResult> {
  return processTravelMessage(input);
}

/** Multi-turn helper that threads state for callers. */
export async function continueTravelConversation(
  message: string,
  previousState: ConversationState | undefined,
  options?: Omit<ProcessMessageInput, 'message' | 'previousState'>,
): Promise<IntelligenceResult> {
  return processTravelMessage({
    message,
    previousState,
    ...options,
  });
}
