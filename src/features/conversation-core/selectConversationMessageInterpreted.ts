import type { ConversationStateChangeClassification } from './classifyConversationStateChange';

/**
 * Determine whether the current turn interpreted any travel-field change.
 *
 * Phase 10J — owns the messageInterpreted rule used by the reply planner.
 * True when any canonical travel field changed during the current turn;
 * false when none did.
 */
export function selectConversationMessageInterpreted(
  classification: ConversationStateChangeClassification,
): boolean {
  return classification.hasAnyChange;
}
