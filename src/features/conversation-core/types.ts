/**
 * Canonical first-principles conversation-core state.
 *
 * Phase 2B records chronological user + assistant transcript entries only.
 * No travel intelligence, persistence, or schema lineage.
 */

/** Reserved for a later persistence piece — not used in this phase. */
export const CONVERSATION_CORE_STORAGE_NAMESPACE =
  'aleya-travel:conversation-core:first-principles' as const;

export type ConversationCoreStatus = 'empty';

/** Chronological transcript memory only — not intelligence. */
export type ConversationTranscriptEntry =
  | {
      id: string;
      role: 'user';
      message: string;
      timestamp: string;
    }
  | {
      id: string;
      role: 'assistant';
      message: string;
      timestamp: string;
    };

export type ConversationCoreState = {
  conversationId: string;
  status: ConversationCoreStatus;
  turnCount: 0;
  createdAt: string;
  updatedAt: string;
  transcript: ConversationTranscriptEntry[];
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
    transcript: [],
  };
}
