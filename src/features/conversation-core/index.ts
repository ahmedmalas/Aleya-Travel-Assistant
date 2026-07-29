/**
 * conversation-core — first-principles empty boundary.
 *
 * Public surface:
 * - createInitialConversationCoreState (sole state factory)
 * - processConversationTurn (sole turn entry)
 *
 * Persistence namespace is reserved and must not be enabled yet.
 */

export {
  CONVERSATION_CORE_STORAGE_NAMESPACE,
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationCoreStatus,
  type CreateInitialConversationCoreStateInput,
} from './types';

export {
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ProcessConversationTurnInput,
  type ProcessConversationTurnResult,
  type ProcessConversationTurnTrace,
} from './processTurn';
