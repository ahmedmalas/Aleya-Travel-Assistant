import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { evaluateBaselineConversationalReplyPlanOutcome } from './evaluateBaselineConversationalReplyPlanOutcome';

/**
 * Phase 14J — non-production baseline conversational evaluation entry point.
 * Phase 14L — delegates through the outcome boundary so fallback remains
 * observable for comparison without changing this string contract.
 *
 * Not used by production reply generation. Not exported from index.ts.
 */

export type EvaluateBaselineConversationalReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export function evaluateBaselineConversationalReplyPlan(
  input: EvaluateBaselineConversationalReplyPlanInput,
): string {
  return evaluateBaselineConversationalReplyPlanOutcome({
    plan: input.plan,
  }).reply;
}
