import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationTranscriptEntry,
} from './types';

/** Temporary boundary reply — no capture of assistant text, inference, or search. */
export const ENGINE_NOT_ASSEMBLED_REPLY =
  'The new Aleya conversation engine has not been assembled yet. Trip planning turns are temporarily unavailable.';

export type ProcessConversationTurnTrace = {
  entryPoint: 'processConversationTurn';
  stateStatus: 'empty';
  turnCount: 0;
  stateChanged: true;
  messageInterpreted: false;
  persistenceUsed: false;
  userMessageRecorded: true;
};

export type ProcessConversationTurnInput = {
  message: string;
  /** Required — used as the transcript entry timestamp (ISO from this instant). */
  now: Date;
  /** Required — transcript entry id (injected for determinism). */
  entryId: string;
  state?: ConversationCoreState;
  /** Required when `state` is omitted — keeps the factory free of hidden globals. */
  conversationId?: string;
};

export type ProcessConversationTurnResult = {
  state: ConversationCoreState;
  reply: string;
  trace: ProcessConversationTurnTrace;
};

const RECORDING_TRACE: ProcessConversationTurnTrace = {
  entryPoint: 'processConversationTurn',
  stateStatus: 'empty',
  turnCount: 0,
  stateChanged: true,
  messageInterpreted: false,
  persistenceUsed: false,
  userMessageRecorded: true,
};

/**
 * Sole public turn-processing entry point for conversation-core.
 *
 * Phase 2A: append the raw user message to transcript exactly as received.
 * Does not interpret, trim, normalise, record assistant replies, increment
 * turns, or persist.
 */
export function processConversationTurn(
  input: ProcessConversationTurnInput,
): ProcessConversationTurnResult {
  const base = resolveBaseState(input);
  const entry: ConversationTranscriptEntry = {
    id: input.entryId,
    role: 'user',
    message: input.message,
    timestamp: input.now.toISOString(),
  };

  const state: ConversationCoreState = {
    conversationId: base.conversationId,
    status: 'empty',
    turnCount: 0,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    transcript: [...base.transcript, entry],
  };

  return {
    state,
    reply: ENGINE_NOT_ASSEMBLED_REPLY,
    trace: RECORDING_TRACE,
  };
}

function resolveBaseState(input: ProcessConversationTurnInput): ConversationCoreState {
  if (input.state) return input.state;

  if (!input.conversationId) {
    throw new Error(
      'processConversationTurn requires state, or conversationId when creating initial state',
    );
  }

  return createInitialConversationCoreState({
    conversationId: input.conversationId,
    now: input.now,
  });
}
