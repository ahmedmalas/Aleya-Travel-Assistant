import type { ConversationalLayerRenderer } from './conversationalLayerContracts';
import { renderConversationReplyPlan } from './generateConversationReply';

/**
 * Phase 13H — deterministic conversational-layer baseline renderer.
 * Phase 13I — typed as ConversationalLayerRenderer.
 *
 * Consumes an existing ConversationalLayerInput and returns wording-only
 * ConversationalLayerOutput by delegating to the existing deterministic reply
 * renderer on input.plan.
 *
 * Ignores styleProfile. Allows objective to be null. Objective metadata never
 * overrides the plan. Does not inspect authoritative trip state or original
 * user text, does not recalculate follow-up ordering or suppression rules, and
 * does not mutate the input.
 *
 * Not an AI implementation. Not wired into reply generation or turn processing.
 */
export const renderBaselineConversationalLayer: ConversationalLayerRenderer = (
  input,
) => ({
  wording: renderConversationReplyPlan(input.plan),
});
