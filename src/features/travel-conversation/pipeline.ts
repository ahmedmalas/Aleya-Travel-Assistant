/**
 * Authoritative pipeline — dialogue orchestration is the sole production path.
 *
 * normalize → dialogue (context → goals → decide → execute tools → NLG)
 *
 * Tools used internally (not speaking for Aleya):
 * extract / assign / merge / clarify / search projection / search memory
 */

import { runDialogueTurn, resetDialogueRuntime } from './dialogue';
import {
  getTravelConversation,
  resetTravelConversation,
  setTravelConversation,
} from './store';
import type { ConversationState, TravelTurnResult } from './types';
import { createEmptyConversationState } from './types';
import { evaluateClarification } from './clarify';

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

  const result = runDialogueTurn({
    message: input.message,
    previousState: previous,
    now: input.now,
    commitTranscript: input.commit !== false,
  });

  if (input.commit !== false && input.previousState === undefined) {
    setTravelConversation(result.state);
  } else if (input.commit && input.previousState !== undefined) {
    setTravelConversation(result.state);
  }

  const clarification = evaluateClarification(result.state);

  return {
    state: result.state,
    reply: result.reply,
    clarification,
    activateSearch: result.activateSearch,
    continueSearch: result.continueSearch,
    servicesToSearch: result.servicesToSearch,
    searchPerformed: result.searchPerformed,
    searchSessionActive: result.searchSessionActive,
    decision: result.decision,
    trace: result.trace,
  };
}

export function sendTravelMessage(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): TravelTurnResult {
  getTravelConversation();
  return processTravelTurn({ ...input, commit: true });
}

export function resetConversationRuntime(): ConversationState {
  resetDialogueRuntime();
  return resetTravelConversation();
}

export { createEmptyConversationState, resetDialogueRuntime };
