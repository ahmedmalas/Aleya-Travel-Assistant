/**
 * Canonical first-principles conversation-core state.
 *
 * Travel intelligence, transcript, persistence, and schema lineage are
 * intentionally absent. Later phases extend this contract deliberately.
 */

/** Reserved for a later persistence piece — not used in this phase. */
export const CONVERSATION_CORE_STORAGE_NAMESPACE =
  'aleya-travel:conversation-core:first-principles' as const;

export type ConversationCoreStatus = 'empty';

export type ConversationCoreState = {
  conversationId: string;
  status: ConversationCoreStatus;
  turnCount: 0;
  createdAt: string;
  updatedAt: string;
};

export type CreateInitialConversationCoreStateInput = {
  conversationId: string;
  now: Date;
};

/**
 * Sole public initial-state factory.
 *
 * Deterministic for identical inputs. Does not read time or ID from globals.
 */
export function createInitialConversationCoreState(
  input: CreateInitialConversationCoreStateInput,
): ConversationCoreState {
  const instant = input.now.toISOString();
  return {
    conversationId: input.conversationId,
    status: 'empty',
    turnCount: 0,
    createdAt: instant,
    updatedAt: instant,
  };
}
