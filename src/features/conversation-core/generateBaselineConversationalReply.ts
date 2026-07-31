import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import type { ConversationalStyleProfile } from './conversationalLayerContracts';
import { renderBaselineConversationalReplyPlan } from './renderBaselineConversationalReplyPlan';

/**
 * Phase 13P — pure convenience boundary for baseline conversational wording.
 *
 * Accepts a ConversationReplyPlan (and optional style profile), executes
 * renderBaselineConversationalReplyPlan, and returns output.wording exactly.
 *
 * Does not inspect reply-plan fields, does not derive an objective, does not
 * build layer input or access a renderer registry itself, does not alter the
 * returned wording, and does not introduce runtime reply integration.
 */
export function generateBaselineConversationalReply(
  plan: Readonly<ConversationReplyPlan>,
  styleProfile?: Readonly<ConversationalStyleProfile>,
): string {
  return renderBaselineConversationalReplyPlan(plan, styleProfile).wording;
}
