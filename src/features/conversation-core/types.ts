/**
 * First-principles conversation-core state.
 *
 * This is intentionally empty of travel intelligence. It is not a continuation
 * of any prior conversation lineage and must never load, migrate, or recover
 * prior state.
 */

/** Reserved for a later persistence piece — not used in this phase. */
export const CONVERSATION_CORE_STORAGE_NAMESPACE =
  'aleya-travel:conversation-core:first-principles' as const;

export type ConversationCoreNamespace =
  typeof CONVERSATION_CORE_STORAGE_NAMESPACE;

export type ConversationCoreState = {
  namespace: ConversationCoreNamespace;
  sessionId: string;
  createdAt: string;
};

export function createInitialConversationCoreState(
  now: Date = new Date(),
): ConversationCoreState {
  const sessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `conversation-core-${now.getTime()}`;

  return {
    namespace: CONVERSATION_CORE_STORAGE_NAMESPACE,
    sessionId,
    createdAt: now.toISOString(),
  };
}
