/**
 * conversation-core — first-principles empty boundary.
 *
 * Public surface:
 * - createInitialConversationCoreState (sole state factory)
 * - processConversationTurn (sole turn entry)
 * - ConversationStateUpdate (sole explicit travel-field update boundary)
 * - ConversationStateExtractionResult (sole future extractor output contract)
 * - ConversationStateExtractionInput (sole future extractor input contract)
 * - ConversationStateExtractor (sole future extractor interface contract)
 *
 * Phase 2B records raw user + assistant transcript entries. Phase 10B fills
 * the assistant reply via an internal reply-generation boundary.
 * Persistence namespace is reserved and must not be enabled yet.
 */

export {
  CONVERSATION_CORE_STORAGE_NAMESPACE,
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationCoreStatus,
  type ConversationStateExtractionInput,
  type ConversationStateExtractionResult,
  type ConversationStateExtractor,
  type ConversationStateUpdate,
  type ConversationTranscriptEntry,
  type CreateInitialConversationCoreStateInput,
} from './types';

export {
  processConversationTurn,
  type ProcessConversationTurnInput,
  type ProcessConversationTurnResult,
  type ProcessConversationTurnTrace,
} from './processTurn';
