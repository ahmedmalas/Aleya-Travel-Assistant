import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { generateBaselineConversationalReply } from './generateBaselineConversationalReply';
import { renderConversationReplyPlan } from './generateConversationReply';

/**
 * Phase 14D/14E — plan-level reply rendering seam.
 * Phase 14F — explicit deterministic plan-rendering integration mode.
 * Phase 14G — unselected baseline-conversational branch (statically unused).
 *
 * Shared internal contract boundary: ConversationReplyPlan → rendered reply.
 * Production selection remains statically `'deterministic'`. The baseline
 * conversational branch is present for exhaustive mode coverage but is not
 * selected. Does not accept a mode argument, read environment variables, or
 * use feature flags.
 *
 * Not exported from index.ts.
 */

/** Internal plan-rendering mode contract. Phase 14G includes an unselected baseline branch. */
type ConversationReplyPlanIntegrationMode =
  | 'deterministic'
  | 'baseline-conversational';

export type RenderIntegratedConversationReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export function renderIntegratedConversationReplyPlan(
  input: RenderIntegratedConversationReplyPlanInput,
): string {
  const mode: ConversationReplyPlanIntegrationMode = 'deterministic' as ConversationReplyPlanIntegrationMode;
  switch (mode) {
    case 'deterministic':
      return renderConversationReplyPlan(input.plan);
    case 'baseline-conversational':
      return generateBaselineConversationalReply(input.plan);
  }
}
