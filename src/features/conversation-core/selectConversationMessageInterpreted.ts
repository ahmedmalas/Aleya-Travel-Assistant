import type { ConversationStateChangeClassification } from './classifyConversationStateChange';

/**
 * Determine whether the current turn interpreted any travel-field change.
 *
 * Phase 10J — owns the messageInterpreted rule used by the reply planner.
 * Phase 11G — true when any canonical travel field changed, including
 * acknowledgement-inert request-flag clears to null (hasInterpretedChange).
 * False only when no travel field differed.
 */
export function selectConversationMessageInterpreted(
  classification: ConversationStateChangeClassification,
): boolean {
  return classification.hasInterpretedChange;
}
