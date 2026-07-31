import type { ConversationalLayerRenderer } from './conversationalLayerContracts';
import { renderConversationReplyPlan } from './generateConversationReply';
import { transformBaselineAcknowledgement } from './transformBaselineAcknowledgement';

/**
 * Phase 13H — deterministic conversational-layer baseline renderer.
 * Phase 13I — typed as ConversationalLayerRenderer.
 * Phase 15B — acknowledgement-only conversational transform when eligible.
 *
 * Consumes an existing ConversationalLayerInput and returns wording-only
 * ConversationalLayerOutput. Eligible acknowledgement-only plans
 * (`acknowledgements.length === 1` and `followUpQuestion === null`) apply
 * transformBaselineAcknowledgement to the single acknowledgement string.
 * All other plans continue to delegate to the deterministic reply renderer.
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
  return {
    wording: renderConversationReplyPlan(plan),
  };
};
