import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { renderConversationReplyPlan } from './generateConversationReply';

/**
 * Phase 14D/14E — plan-level reply rendering seam.
 * Phase 14F — explicit deterministic plan-rendering integration mode.
 *
 * Shared internal contract boundary: ConversationReplyPlan → rendered reply.
 * Selects the deterministic renderer via an explicit internal mode constant.
 * Does not accept a mode argument, read environment variables, use feature
 * flags, assemble plans, or invoke the conversational layer.
 *
 * Not exported from index.ts.
 */

/** Internal plan-rendering mode contract. Phase 14F allows only deterministic. */
type ConversationReplyPlanIntegrationMode = 'deterministic';

export type RenderIntegratedConversationReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export function renderIntegratedConversationReplyPlan(
  input: RenderIntegratedConversationReplyPlanInput,
): string {
  const mode: ConversationReplyPlanIntegrationMode = 'deterministic';
  switch (mode) {
    case 'deterministic':
      return renderConversationReplyPlan(input.plan);
  }
}
