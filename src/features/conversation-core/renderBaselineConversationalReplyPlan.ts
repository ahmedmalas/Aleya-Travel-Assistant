import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { buildConversationalLayerInput } from './buildConversationalLayerInput';
import type {
  ConversationalLayerOutput,
  ConversationalStyleProfile,
} from './conversationalLayerContracts';
import { executeBaselineConversationalRenderer } from './executeBaselineConversationalRenderer';

/**
 * Phase 13O — pure baseline conversational reply-plan adapter.
 *
 * Builds ConversationalLayerInput through buildConversationalLayerInput, then
 * executes the registered baseline renderer through
 * executeBaselineConversationalRenderer.
 *
 * Does not inspect reply-plan fields, does not derive the objective itself,
 * does not render wording itself, and does not introduce runtime reply
 * integration.
 */
export function renderBaselineConversationalReplyPlan(
  plan: Readonly<ConversationReplyPlan>,
  styleProfile?: Readonly<ConversationalStyleProfile>,
): ConversationalLayerOutput {
  const input = buildConversationalLayerInput(plan, styleProfile);
  return executeBaselineConversationalRenderer(input);
}
