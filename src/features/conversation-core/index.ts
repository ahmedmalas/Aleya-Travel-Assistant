/**
 * conversation-core — first-principles empty boundary.
 *
 * Exactly one public turn entry point: processConversationTurn.
 * Persistence namespace is reserved and must not be enabled yet.
 */

export {
  CONVERSATION_CORE_STORAGE_NAMESPACE,
  createInitialConversationCoreState,
  type ConversationCoreNamespace,
  type ConversationCoreState,
} from './types';

export {
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ProcessConversationTurnInput,
  type ProcessConversationTurnResult,
} from './processTurn';
