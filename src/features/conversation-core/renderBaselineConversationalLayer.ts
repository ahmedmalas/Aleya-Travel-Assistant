import type { ConversationalLayerRenderer } from './conversationalLayerContracts';
import { renderConversationReplyPlan } from './generateConversationReply';
import { renderBaselineAcknowledgementFollowUp } from './renderBaselineAcknowledgementFollowUp';
import { transformBaselineAcknowledgement } from './transformBaselineAcknowledgement';

/**
 * Phase 13H — deterministic conversational-layer baseline renderer.
 * Phase 13I — typed as ConversationalLayerRenderer.
 * Phase 15B — acknowledgement-only conversational transform when eligible.
 * Phase 15C — acknowledgement-plus-follow-up transition when eligible.
 *
 * Consumes an existing ConversationalLayerInput and returns wording-only
 * ConversationalLayerOutput.
 *
 * Branching order:
 * 1. single acknowledgement + no follow-up → Phase 15B transform
 * 2. single acknowledgement + follow-up → Phase 15C transition renderer
 * 3. all other plan shapes → deterministic renderConversationReplyPlan
 *
 * Ignores styleProfile. Allows objective to be null. Objective metadata never
 * overrides the plan. Does not inspect authoritative trip state or original
 * user text, does not recalculate follow-up ordering or suppression rules, and
 * does not mutate the input.
 *
 * Not an AI implementation.
 */
export const renderBaselineConversationalLayer: ConversationalLayerRenderer = (
  input,
) => {
  const { plan } = input;
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion === null
  ) {
    return {
      wording: transformBaselineAcknowledgement(plan.acknowledgements[0]!),
    };
  }
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion !== null
  ) {
    return {
      wording: renderBaselineAcknowledgementFollowUp({
        acknowledgement: plan.acknowledgements[0]!,
        followUpQuestion: plan.followUpQuestion,
      }),
    };
  }
  return {
    wording: renderConversationReplyPlan(plan),
  };
};
