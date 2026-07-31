import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { evaluateBaselineConversationalReplyPlan } from './evaluateBaselineConversationalReplyPlan';
import { renderConversationReplyPlanByIntegrationMode } from './renderConversationReplyPlanByIntegrationMode';

/**
 * Phase 14K — structured baseline conversational reply-plan comparison.
 *
 * Renders the same ConversationReplyPlan through deterministic and baseline
 * evaluation paths and reports parity. Evaluation-only; not used by production
 * reply generation. Not exported from index.ts.
 */

export type CompareBaselineConversationalReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export type BaselineConversationalReplyPlanComparison = Readonly<{
  deterministicReply: string;
  baselineReply: string;
  matchesDeterministic: boolean;
}>;

export function compareBaselineConversationalReplyPlan(
  input: CompareBaselineConversationalReplyPlanInput,
): BaselineConversationalReplyPlanComparison {
  const deterministicReply = renderConversationReplyPlanByIntegrationMode({
    plan: input.plan,
    mode: 'deterministic',
  });

  const baselineReply = evaluateBaselineConversationalReplyPlan({
    plan: input.plan,
  });

  return {
    deterministicReply,
    baselineReply,
    matchesDeterministic: deterministicReply === baselineReply,
  };
}
