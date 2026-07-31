import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { evaluateBaselineConversationalReplyPlanOutcome } from './evaluateBaselineConversationalReplyPlanOutcome';
import { renderConversationReplyPlanByIntegrationMode } from './renderConversationReplyPlanByIntegrationMode';

/**
 * Phase 14K — structured baseline conversational reply-plan comparison.
 * Phase 14L — classifies identical, different, and fallback outcomes.
 *
 * Renders the same ConversationReplyPlan through deterministic and baseline
 * evaluation paths and reports parity plus status. Evaluation-only; not used
 * by production reply generation. Not exported from index.ts.
 */

export type CompareBaselineConversationalReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export type BaselineConversationalComparisonStatus =
  | 'identical'
  | 'different'
  | 'fallback';

export type BaselineConversationalReplyPlanComparison = Readonly<{
  deterministicReply: string;
  baselineReply: string;
  matchesDeterministic: boolean;
  status: BaselineConversationalComparisonStatus;
}>;

export function compareBaselineConversationalReplyPlan(
  input: CompareBaselineConversationalReplyPlanInput,
): BaselineConversationalReplyPlanComparison {
  const deterministicReply = renderConversationReplyPlanByIntegrationMode({
    plan: input.plan,
    mode: 'deterministic',
  });

  const baselineOutcome = evaluateBaselineConversationalReplyPlanOutcome({
    plan: input.plan,
  });
  const baselineReply = baselineOutcome.reply;
  const matchesDeterministic = deterministicReply === baselineReply;

  const status: BaselineConversationalComparisonStatus =
    baselineOutcome.usedFallback
      ? 'fallback'
      : matchesDeterministic
        ? 'identical'
        : 'different';

  return {
    deterministicReply,
    baselineReply,
    matchesDeterministic,
    status,
  };
}
