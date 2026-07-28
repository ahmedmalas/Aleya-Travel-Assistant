import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from './types';

/** Temporary boundary reply — no capture, inference, or search. */
export const ENGINE_NOT_ASSEMBLED_REPLY =
  'The new Aleya conversation engine has not been assembled yet. Trip planning turns are temporarily unavailable.';

export type ProcessConversationTurnInput = {
  message: string;
  state?: ConversationCoreState;
  now?: Date;
};

export type ProcessConversationTurnResult = {
  state: ConversationCoreState;
  reply: string;
};

/**
 * Sole public turn-processing entry point for conversation-core.
 *
 * Deterministic empty-boundary behaviour only. No persistence, migrations,
 * extraction, service inference, or search activation.
 */
export function processConversationTurn(
  input: ProcessConversationTurnInput,
): ProcessConversationTurnResult {
  void input.message;
  const state =
    input.state ?? createInitialConversationCoreState(input.now ?? new Date());

  return {
    state,
    reply: ENGINE_NOT_ASSEMBLED_REPLY,
  };
}
