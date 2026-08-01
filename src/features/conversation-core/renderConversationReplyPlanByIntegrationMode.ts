import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { generateBaselineConversationalReply } from './generateBaselineConversationalReply';
import { renderConversationReplyPlan } from './generateConversationReply';

/**
 * Phase 14H — mode-driven plan renderer (internal testable contract).
 * Phase 14I — deterministic fallback when the baseline conversational branch fails.
 * Phase 20B — freeze: production wrapper always supplies
 * `'baseline-conversational'`; `'deterministic'` remains the fallback/test branch.
 *
 * Exhaustive ConversationReplyPlan → rendered reply switch by integration mode.
 * Production never calls this entry with a caller-chosen mode; only
 * renderIntegratedConversationReplyPlan supplies the frozen production mode.
 * Module-level exports exist for direct testing and are not re-exported from
 * index.ts.
 */

export type ConversationReplyPlanIntegrationMode =
  | 'deterministic'
  | 'baseline-conversational';

export type RenderConversationReplyPlanByIntegrationModeInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
  mode: ConversationReplyPlanIntegrationMode;
}>;

export function renderConversationReplyPlanByIntegrationMode(
  input: RenderConversationReplyPlanByIntegrationModeInput,
): string {
  switch (input.mode) {
    case 'deterministic':
      return renderConversationReplyPlan(input.plan);
    case 'baseline-conversational':
      try {
        return generateBaselineConversationalReply(input.plan);
      } catch {
        return renderConversationReplyPlan(input.plan);
      }
  }
}
