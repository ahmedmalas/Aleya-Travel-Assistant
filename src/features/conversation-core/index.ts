/**
 * conversation-core — first-principles empty boundary.
 *
 * Public surface:
 * - createInitialConversationCoreState (sole state factory)
 * - processConversationTurn (sole turn entry)
 * - ConversationStateUpdate (sole explicit travel-field update boundary)
 * - ConversationStateExtractionResult (sole future extractor output contract)
 *
 * Phase 2B records raw user + placeholder assistant transcript entries only.
 * Persistence namespace is reserved and must not be enabled yet.
 */

export {
  CONVERSATION_CORE_STORAGE_NAMESPACE,
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationCoreStatus,
  type ConversationStateExtractionResult,
  type ConversationStateUpdate,
  type ConversationTranscriptEntry,
  type CreateInitialConversationCoreStateInput,
} from './types';

export {
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ProcessConversationTurnInput,
  type ProcessConversationTurnResult,
  type ProcessConversationTurnTrace,
} from './processTurn';
