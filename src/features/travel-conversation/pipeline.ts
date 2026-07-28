/**
 * Authoritative pipeline — consultant agent loop is the sole production path.
 *
 * normalize → consultant (context → reason → validate → execute → respond)
 */

import { runConsultantTurn, resetConsultantRuntime } from './consultant';
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

  const result = runConsultantTurn({
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
    observation: result.observation,
  };
}

export function sendTravelMessage(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): TravelTurnResult {
  getTravelConversation();
  return processTravelTurn({ ...input, commit: true });
}

export function resetConversationRuntime(): ConversationState {
  resetConsultantRuntime();
  return resetTravelConversation();
}

export { createEmptyConversationState, resetConsultantRuntime };
