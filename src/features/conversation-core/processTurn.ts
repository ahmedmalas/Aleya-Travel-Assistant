import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from './types';

/** Temporary boundary reply — no capture, inference, or search. */
export const ENGINE_NOT_ASSEMBLED_REPLY =
  'The new Aleya conversation engine has not been assembled yet. Trip planning turns are temporarily unavailable.';

export type ProcessConversationTurnTrace = {
  entryPoint: 'processConversationTurn';
  stateStatus: 'empty';
  turnCount: 0;
  stateChanged: false;
  messageInterpreted: false;
  persistenceUsed: false;
};

export type ProcessConversationTurnInput = {
  message: string;
  state?: ConversationCoreState;
  /** Required when `state` is omitted — keeps the factory free of hidden globals. */
  conversationId?: string;
  now?: Date;
};

export type ProcessConversationTurnResult = {
  state: ConversationCoreState;
  reply: string;
  trace: ProcessConversationTurnTrace;
};

const EMPTY_TRACE: ProcessConversationTurnTrace = {
  entryPoint: 'processConversationTurn',
  stateStatus: 'empty',
  turnCount: 0,
  stateChanged: false,
  messageInterpreted: false,
  persistenceUsed: false,
};

/**
 * Sole public turn-processing entry point for conversation-core.
 *
 * Returns the deterministic not-assembled reply. Does not interpret the
 * message, mutate supplied state, increment turns, or persist anything.
 */
export function processConversationTurn(
  input: ProcessConversationTurnInput,
): ProcessConversationTurnResult {
  void input.message;

  const state = resolveState(input);

  return {
    state,
    reply: ENGINE_NOT_ASSEMBLED_REPLY,
    trace: EMPTY_TRACE,
  };
}

function resolveState(input: ProcessConversationTurnInput): ConversationCoreState {
  if (input.state) return input.state;

  if (!input.conversationId || !input.now) {
    throw new Error(
      'processConversationTurn requires state, or both conversationId and now',
    );
  }

  return createInitialConversationCoreState({
    conversationId: input.conversationId,
    now: input.now,
  });
}
