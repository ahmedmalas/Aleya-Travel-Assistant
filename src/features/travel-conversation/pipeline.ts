/**
 * Authoritative pipeline — conversation progression is the sole production path.
 *
 * sendTravelMessage / processTravelTurn → runConversationTurn → domain tools
 * sendTravelMessageAsync warms the remote location provider cache first.
 */

import { resolveLocationsForMessageAsync } from '../travel-location-intelligence';
import {
  getAwaitingField,
  runConversationTurn,
  resetConversationRuntime as resetProgressionRuntime,
} from './conversation';
import {
  getTravelConversation,
  resetTravelConversation,
  setTravelConversation,
} from './store';
import type { ConversationState, TravelTurnResult } from './types';
import { createEmptyConversationState } from './types';

export type SendTravelMessageInput = {
  message: string;
  now?: Date;
  travellerName?: string;
  previousState?: ConversationState;
  commit?: boolean;
};

export function processTravelTurn(input: SendTravelMessageInput): TravelTurnResult {
  const previous =
    input.previousState !== undefined ? input.previousState : getTravelConversation();

  const progression = runConversationTurn({
    message: input.message,
    previousState: previous,
    now: input.now,
    commitTranscript: input.commit !== false,
  });

  if (input.commit !== false && input.previousState === undefined) {
    setTravelConversation(progression.state);
  } else if (input.commit && input.previousState !== undefined) {
    setTravelConversation(progression.state);
  }

  return {
    state: progression.state,
    reply: progression.reply,
    activateSearch: progression.activateSearch,
    continueSearch: progression.continueSearch,
    servicesToSearch: progression.servicesToSearch,
    searchPerformed: progression.searchPerformed,
    searchSessionActive: progression.searchSessionActive,
    progression,
    runtimeEvidence: progression.runtimeEvidence,
  };
}

export function sendTravelMessage(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): TravelTurnResult {
  getTravelConversation();
  return processTravelTurn({ ...input, commit: true });
}

/**
 * Production chat path: warm remote geocoder cache, then run the sync turn.
 * Remote failure must not block or corrupt the conversation.
 */
export async function sendTravelMessageAsync(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): Promise<TravelTurnResult> {
  const previous = getTravelConversation();
  try {
    await resolveLocationsForMessageAsync({
      message: input.message,
      awaitingField: getAwaitingField(),
      destinationBefore: previous.destination?.value,
      originBefore: previous.origin?.value,
    });
  } catch {
    // Provider failure must not destroy conversation state.
  }
  return sendTravelMessage(input);
}

export function resetConversationRuntime(): ConversationState {
  resetProgressionRuntime();
  return resetTravelConversation();
}

export { createEmptyConversationState, resetProgressionRuntime };
