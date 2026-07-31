import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import {
  createConversationalLayerInput,
  type ConversationalLayerInput,
  type ConversationalStyleProfile,
} from './conversationalLayerContracts';
import { selectConversationalObjective } from './selectConversationalObjective';

/**
 * Phase 13G — pure conversational layer input adapter.
 *
 * Packages an already-assembled ConversationReplyPlan into ConversationalLayerInput
 * by deriving the objective exclusively through selectConversationalObjective(plan)
 * and delegating immutable packaging to createConversationalLayerInput.
 *
 * Does not inspect authoritative trip state or original user text, does not
 * recalculate follow-up ordering or suppression rules, does not render wording,
 * and does not mutate the plan or style profile.
 *
 * Not wired into reply generation or turn processing.
 */
export function buildConversationalLayerInput(
  plan: Readonly<ConversationReplyPlan>,
  styleProfile?: Readonly<ConversationalStyleProfile>,
): ConversationalLayerInput {
  const objective = selectConversationalObjective(plan);
  return createConversationalLayerInput(
    plan,
    objective,
    styleProfile,
  );
}
