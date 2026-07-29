import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationTranscriptEntry,
} from './types';

/** Temporary boundary reply — no capture of assistant intelligence, inference, or search. */
export const ENGINE_NOT_ASSEMBLED_REPLY =
  'The new Aleya conversation engine has not been assembled yet. Trip planning turns are temporarily unavailable.';

export type ProcessConversationTurnTrace = {
  entryPoint: 'processConversationTurn';
  stateStatus: 'active';
  turnCount: number;
  stateChanged: true;
  messageInterpreted: false;
  persistenceUsed: false;
  userMessageRecorded: true;
  assistantMessageRecorded: true;
};

export type ProcessConversationTurnInput = {
  message: string;
  userEntryId: string;
  assistantEntryId: string;
  userMessageAt: Date;
  assistantMessageAt: Date;
  state?: ConversationCoreState;
  /** Required when `state` is omitted — keeps the factory free of hidden globals. */
  conversationId?: string;
};

export type ProcessConversationTurnResult = {
  state: ConversationCoreState;
  reply: string;
  trace: ProcessConversationTurnTrace;
};

/**
 * Sole public turn-processing entry point for conversation-core.
 *
 * Phase 2E: append raw user + placeholder assistant entries, increment
 * turnCount by one, set updatedAt from assistantMessageAt, and set status
 * to active. Does not interpret, trim, normalise, or persist.
 */
export function processConversationTurn(
  input: ProcessConversationTurnInput,
): ProcessConversationTurnResult {
  const base = resolveBaseState(input);
  const nextTurnCount = base.turnCount + 1;
  const assistantTimestamp = input.assistantMessageAt.toISOString();

  const userEntry: ConversationTranscriptEntry = {
    id: input.userEntryId,
    role: 'user',
    message: input.message,
    timestamp: input.userMessageAt.toISOString(),
  };

  const assistantEntry: ConversationTranscriptEntry = {
    id: input.assistantEntryId,
    role: 'assistant',
    message: ENGINE_NOT_ASSEMBLED_REPLY,
    timestamp: assistantTimestamp,
  };

  const state: ConversationCoreState = {
    conversationId: base.conversationId,
    status: 'active',
    turnCount: nextTurnCount,
    createdAt: base.createdAt,
    updatedAt: assistantTimestamp,
    transcript: [...base.transcript, userEntry, assistantEntry],
  };

  return {
    state,
    reply: ENGINE_NOT_ASSEMBLED_REPLY,
    trace: {
      entryPoint: 'processConversationTurn',
      stateStatus: 'active',
      turnCount: nextTurnCount,
      stateChanged: true,
      messageInterpreted: false,
      persistenceUsed: false,
      userMessageRecorded: true,
      assistantMessageRecorded: true,
    },
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
    now: input.userMessageAt,
  });
}
