import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import {
  renderConversationReplyPlanByIntegrationMode,
  type ConversationReplyPlanIntegrationMode,
} from './renderConversationReplyPlanByIntegrationMode';

/**
 * Phase 14D/14E — plan-level reply rendering seam.
 * Phase 14F — explicit deterministic plan-rendering integration mode.
 * Phase 14G — unselected baseline-conversational branch (statically unused).
 * Phase 14H — production wrapper permanently selects `'deterministic'` and
 * delegates to renderConversationReplyPlanByIntegrationMode.
 *
 * Shared internal contract boundary: ConversationReplyPlan → rendered reply.
 * Does not accept a mode argument, read environment variables, or use feature
 * flags.
 *
 * Not exported from index.ts.
 */

export type RenderIntegratedConversationReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export function renderIntegratedConversationReplyPlan(
  input: RenderIntegratedConversationReplyPlanInput,
): string {
  const mode: ConversationReplyPlanIntegrationMode = 'deterministic';
  return renderConversationReplyPlanByIntegrationMode({
    plan: input.plan,
    mode,
  });
}
