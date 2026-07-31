import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { generateBaselineConversationalReply } from './generateBaselineConversationalReply';
import { renderConversationReplyPlan } from './generateConversationReply';

/**
 * Phase 14H — mode-driven plan renderer (internal testable contract).
 *
 * Exhaustive ConversationReplyPlan → rendered reply switch by integration mode.
 * Production never selects a mode through this entry; the production wrapper
 * always supplies `'deterministic'`. Module-level exports exist for direct
 * testing only and are not re-exported from index.ts.
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
      return generateBaselineConversationalReply(input.plan);
  }
}
