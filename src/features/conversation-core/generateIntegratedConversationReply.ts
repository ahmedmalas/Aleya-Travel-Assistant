import {
  generateConversationReply,
  type GenerateConversationReplyInput,
} from './generateConversationReply';

/**
 * Phase 14A — controlled runtime integration seam.
 * Phase 14B — processConversationTurn routes through this seam.
 * Phase 14C — explicit deterministic integration mode.
 *
 * Internal-only pure boundary. Selects the deterministic reply path via an
 * explicit internal mode constant. Does not accept a mode argument, read
 * environment variables, use feature flags, or invoke the conversational layer.
 *
 * Not exported from index.ts.
 */

/** Internal integration-mode contract. Phase 14C allows only deterministic. */
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
