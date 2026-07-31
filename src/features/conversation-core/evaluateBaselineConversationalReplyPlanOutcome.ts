import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { generateBaselineConversationalReply } from './generateBaselineConversationalReply';
import { renderConversationReplyPlanByIntegrationMode } from './renderConversationReplyPlanByIntegrationMode';

/**
 * Phase 14L — evaluation-only baseline outcome boundary.
 *
 * Mirrors the Phase 14I baseline try/catch (success vs deterministic fallback)
 * while exposing whether fallback occurred. Not used by production reply
 * generation. Not exported from index.ts.
 */

export type EvaluateBaselineConversationalReplyPlanOutcomeInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export type EvaluateBaselineConversationalReplyPlanOutcome = Readonly<{
  reply: string;
  usedFallback: boolean;
}>;

export function evaluateBaselineConversationalReplyPlanOutcome(
  input: EvaluateBaselineConversationalReplyPlanOutcomeInput,
): EvaluateBaselineConversationalReplyPlanOutcome {
  try {
    return {
      reply: generateBaselineConversationalReply(input.plan),
      usedFallback: false,
    };
  } catch {
    return {
      reply: renderConversationReplyPlanByIntegrationMode({
        plan: input.plan,
        mode: 'deterministic',
      }),
      usedFallback: true,
    };
  }
}
