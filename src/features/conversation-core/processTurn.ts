import { applyConversationStateUpdate } from './applyConversationStateUpdate';
import { hasConversationStateUpdateChanged } from './hasConversationStateUpdateChanged';
import { transitionConversationStateFromExtraction } from './transitionConversationStateFromExtraction';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateUpdate,
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
  /**
   * Sole explicit travel-field update boundary. Omitted properties preserve
   * prior state; supplied values (including `false` and `null`) are stored
   * exactly. Never read from message text.
   */
  stateUpdate?: ConversationStateUpdate;
};

export type ProcessConversationTurnResult = {
  state: ConversationCoreState;
  reply: string;
  trace: ProcessConversationTurnTrace;
};

/**
 * Sole public turn-processing entry point for conversation-core.
 *
 * Phase 5I: run the internal extraction transition first, then apply any
 * explicit injected ConversationStateUpdate (explicit input wins). Append
 * raw user + placeholder assistant entries, increment turnCount by one, set
 * updatedAt from assistantMessageAt, set status to active, and expose ageMs.
 * Extraction metadata is internal only and does not alter the public result.
 * Does not interpret, trim, normalise, validate counts, calculate duration,
 * or persist.
 */
export function processConversationTurn(
  input: ProcessConversationTurnInput,
): ProcessConversationTurnResult {
  const base = resolveBaseState(input);
  const extractionTransition = transitionConversationStateFromExtraction({
    message: input.message,
    currentState: base,
  });
  const nextTurnCount = base.turnCount + 1;
  const assistantTimestamp = input.assistantMessageAt.toISOString();
  const ageMs =
    input.assistantMessageAt.getTime() - new Date(base.createdAt).getTime();
  const travelStateWouldChange = hasConversationStateUpdateChanged(
    extractionTransition.nextState,
    input.stateUpdate,
  );
  void travelStateWouldChange;
  const travel = applyConversationStateUpdate(
    extractionTransition.nextState,
    input.stateUpdate,
  );

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
    ageMs,
    ...travel,
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
