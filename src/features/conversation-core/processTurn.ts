import { applyConversationStateUpdate } from './applyConversationStateUpdate';
import { generateIntegratedConversationReply } from './generateIntegratedConversationReply';
import { hasSupportedTravelFieldChange } from './generateConversationReply';
import { hasConversationStateUpdateChanged } from './hasConversationStateUpdateChanged';
import { transitionConversationStateFromExtraction } from './transitionConversationStateFromExtraction';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateUpdate,
  type ConversationTranscriptEntry,
} from './types';

export type ProcessConversationTurnTrace = {
  entryPoint: 'processConversationTurn';
  stateStatus: 'active';
  turnCount: number;
  stateChanged: true;
  messageInterpreted: boolean;
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
  /**
   * When true, skip the legacy regex extraction path and apply only
   * `stateUpdate` (from the semantic interpretation boundary). Default false
   * preserves extractor-based tests and fallback callers.
   */
  skipExtraction?: boolean;
  /**
   * When provided, use this reply instead of the form-wizard reply planner.
   * Used by the Consultant Turn Governor production path.
   */
  replyOverride?: string;
};

export type ProcessConversationTurnResult = {
  state: ConversationCoreState;
  reply: string;
  trace: ProcessConversationTurnTrace;
};

/**
 * Sole public turn-processing entry point for conversation-core.
 *
 * Phase 5I/10B: run the internal extraction transition (unless skipExtraction),
 * apply any explicit injected ConversationStateUpdate (explicit input wins),
 * generate a deterministic reply from final travel state via
 * generateIntegratedConversationReply (Phase 14B seam → generateConversationReply),
 * append raw user + assistant transcript entries, increment turnCount by one,
 * set updatedAt from assistantMessageAt, set status to active, and expose ageMs.
 * Does not ask next questions, call search/itinerary, or persist.
 *
 * Semantic AI interpretation lives outside this module; production UI passes
 * validated stateUpdate with skipExtraction after interpretTravelUtterance.
 */
export function processConversationTurn(
  input: ProcessConversationTurnInput,
): ProcessConversationTurnResult {
  const base = resolveBaseState(input);
  const extractionTransition = input.skipExtraction
    ? {
        extractionResult: { stateUpdate: {} as ConversationStateUpdate },
        hasStateChanged: false,
        nextState: base,
      }
    : transitionConversationStateFromExtraction({
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

  const provisionalState: ConversationCoreState = {
    conversationId: base.conversationId,
    status: 'active',
    turnCount: nextTurnCount,
    createdAt: base.createdAt,
    updatedAt: assistantTimestamp,
    ageMs,
    ...travel,
    transcript: base.transcript,
  };

  const reply =
    input.replyOverride !== undefined
      ? input.replyOverride
      : generateIntegratedConversationReply({
          message: input.message,
          state: provisionalState,
          previousState: base,
        });
  const messageInterpreted = hasSupportedTravelFieldChange(base, provisionalState);

  const userEntry: ConversationTranscriptEntry = {
    id: input.userEntryId,
    role: 'user',
    message: input.message,
    timestamp: input.userMessageAt.toISOString(),
  };

  const assistantEntry: ConversationTranscriptEntry = {
    id: input.assistantEntryId,
    role: 'assistant',
    message: reply,
    timestamp: assistantTimestamp,
  };

  const state: ConversationCoreState = {
    ...provisionalState,
    transcript: [...base.transcript, userEntry, assistantEntry],
  };

  return {
    state,
    reply,
    trace: {
      entryPoint: 'processConversationTurn',
      stateStatus: 'active',
      turnCount: nextTurnCount,
      stateChanged: true,
      messageInterpreted,
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
