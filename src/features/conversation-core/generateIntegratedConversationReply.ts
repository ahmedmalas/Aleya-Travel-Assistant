import {
  generateConversationReply,
  type GenerateConversationReplyInput,
} from './generateConversationReply';

/**
 * Phase 14A — controlled runtime integration seam.
 * Phase 14B — processConversationTurn routes through this seam.
 * Phase 14C — turn-routing mode locked to the authoritative reply boundary.
 * Phase 20B — freeze: this seam always delegates to generateConversationReply.
 * Expression-mode selection remains solely inside the plan-level render seam.
 *
 * Internal-only pure boundary. Does not accept a mode argument, read
 * environment variables, or use feature flags. Does not call baseline helpers
 * or the deterministic renderer directly.
 *
 * Not exported from index.ts.
 */

/**
 * Turn-routing integration label (Phase 14C).
 * Means "use generateConversationReply"; does not select wording expression.
 */
type ConversationReplyIntegrationMode = 'deterministic';

export function generateIntegratedConversationReply(
  input: GenerateConversationReplyInput,
): string {
  const mode: ConversationReplyIntegrationMode = 'deterministic';
  switch (mode) {
    case 'deterministic':
      return generateConversationReply(input);
  }
}
