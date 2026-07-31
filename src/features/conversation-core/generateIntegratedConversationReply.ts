import {
  generateConversationReply,
  type GenerateConversationReplyInput,
} from './generateConversationReply';

/**
 * Phase 14A — controlled runtime integration seam (step 1).
 *
 * Internal-only pure boundary reserved for a future conversational-layer
 * integration. This phase delegates entirely to generateConversationReply and
 * introduces no behaviour change, branching, feature flags, or conversational
 * stack usage.
 *
 * Not exported from index.ts.
 * Phase 14B wires processConversationTurn through this seam while preserving
 * exact generateConversationReply behaviour.
 */
export function generateIntegratedConversationReply(
  input: GenerateConversationReplyInput,
): string {
  return generateConversationReply(input);
}
