import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { renderConversationReplyPlanByIntegrationMode } from './renderConversationReplyPlanByIntegrationMode';

/**
 * Phase 14J — non-production baseline conversational evaluation entry point.
 *
 * Explicitly exercises the `'baseline-conversational'` mode through the
 * mode-driven renderer (including Phase 14I deterministic fallback). Not used
 * by production reply generation. Not exported from index.ts.
 */

export type EvaluateBaselineConversationalReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export function evaluateBaselineConversationalReplyPlan(
  input: EvaluateBaselineConversationalReplyPlanInput,
): string {
  return renderConversationReplyPlanByIntegrationMode({
    plan: input.plan,
    mode: 'baseline-conversational',
  });
}
