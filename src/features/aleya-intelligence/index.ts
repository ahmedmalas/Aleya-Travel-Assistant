/**
 * Aleya Intelligence Layer (Phase 1 + Phase 2)
 * All travel chat UIs must call `handleTravelChatMessage` / `processTravelMessage`.
 */

export { processTravelMessage } from './pipeline';
export { createEmptyConversationState } from './types';
export { getContextSummary } from './compress';
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
