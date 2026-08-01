import { NEUTRAL_TRIP_FALLBACK_REPLY } from './conversationReplyCatalogue';

export type SelectConversationContinuationPromptInput = {
  /** Follow-up already selected for this reply plan, if any. */
  followUpQuestion: string | null;
};

/**
 * Select the deterministic continuation prompt when no follow-up applies.
 *
 * Phase 10L — owns the neutral continuation fallback decision previously
 * hard-coded in createConversationReplyPlan. Returns null when a follow-up
 * question already exists; otherwise returns the existing neutral
 * continuation prompt.
 */
export function selectConversationContinuationPrompt(
  input: SelectConversationContinuationPromptInput,
): string | null {
  if (input.followUpQuestion !== null) {
    return null;
  }
  return NEUTRAL_TRIP_FALLBACK_REPLY;
}
