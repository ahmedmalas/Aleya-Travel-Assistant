import type { ConversationalLayerRenderer } from './conversationalLayerContracts';
import { renderConversationReplyPlan } from './generateConversationReply';
import { renderBaselineAcknowledgementFollowUp } from './renderBaselineAcknowledgementFollowUp';
import { renderBaselineAcknowledgementNeutralContinuation } from './renderBaselineAcknowledgementNeutralContinuation';
import { renderBaselineFollowUpOnly } from './renderBaselineFollowUpOnly';
import {
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  renderBaselineNeutralContinuation,
} from './renderBaselineNeutralContinuation';
import { transformBaselineAcknowledgement } from './transformBaselineAcknowledgement';

/**
 * Phase 13H — deterministic conversational-layer baseline renderer.
 * Phase 13I — typed as ConversationalLayerRenderer.
 * Phase 15B — acknowledgement-only conversational transform when eligible.
 * Phase 15C — acknowledgement-plus-follow-up transition when eligible.
 * Phase 15E — follow-up-only conversational lead-in when eligible.
 * Phase 15J — neutral-continuation conversational expression when eligible.
 * Phase 16B — acknowledgement-plus-canonical-neutral bridge when eligible.
 *
 * Consumes an existing ConversationalLayerInput and returns wording-only
 * ConversationalLayerOutput.
 *
 * Branching order:
 * 1. single acknowledgement + canonical neutral → Phase 16B
 * 2. single acknowledgement + no follow-up → Phase 15B transform
 * 3. single acknowledgement + non-neutral follow-up → Phase 15C
 * 4. no acknowledgements + canonical neutral continuation → Phase 15J
 * 5. no acknowledgements + follow-up → Phase 15E/15F follow-up-only renderer
 * 6. all other plan shapes → deterministic renderConversationReplyPlan
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
    plan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
  ) {
    return {
      wording: renderBaselineAcknowledgementNeutralContinuation({
        acknowledgement: plan.acknowledgements[0]!,
        followUpQuestion: plan.followUpQuestion,
      }),
    };
  }
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
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
  ) {
    return {
      wording: renderBaselineNeutralContinuation({
        followUpQuestion: plan.followUpQuestion,
      }),
    };
  }
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion !== null
  ) {
    return {
      wording: renderBaselineFollowUpOnly({
        followUpQuestion: plan.followUpQuestion,
      }),
    };
  }
  return {
    wording: renderConversationReplyPlan(plan),
  };
};
