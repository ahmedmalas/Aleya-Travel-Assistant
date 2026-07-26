/**
 * Aleya Intelligence Core (Phase 1)
 * All travel chat UIs must call `handleTravelChatMessage` / `processTravelMessage`.
 */

export { processTravelMessage } from './pipeline';
export { createEmptyConversationState } from './types';
export type {
  ApproximateDate,
  ConversationState,
  FieldValue,
  IntelligenceResult,
  ProcessMessageInput,
  TravelServiceKind,
  TripPurposeKind,
} from './types';

import { processTravelMessage } from './pipeline';
import type { ConversationState, IntelligenceResult, ProcessMessageInput } from './types';

export function handleTravelChatMessage(input: ProcessMessageInput): IntelligenceResult {
  return processTravelMessage(input);
}

export function continueTravelConversation(
  message: string,
  previousState: ConversationState | undefined,
  options?: Omit<ProcessMessageInput, 'message' | 'previousState'>,
): IntelligenceResult {
  return processTravelMessage({ message, previousState, ...options });
}
