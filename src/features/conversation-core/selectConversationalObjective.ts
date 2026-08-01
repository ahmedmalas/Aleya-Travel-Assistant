import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from './conversationReplyCatalogue';
import type {
  ConversationalObjective,
  ConversationalObjectiveId,
} from './conversationalLayerContracts';

/**
 * Phase 13E — pure conversational objective adapter.
 *
 * Identifies the objective already selected in a ConversationReplyPlan.
 * Does not inspect authoritative trip state or original user text, does not
 * recalculate follow-up ordering or suppression rules, and does not mutate
 * the plan.
 *
 * Not wired into reply generation or turn processing.
 */

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const SPECIFIC_FOLLOW_UP_IDS = [
  'destination',
  'origin',
  'departureDate',
  'returnDate',
  'flightsAdultCount',
  'accommodationGuestCount',
  'activities',
  'restaurants',
] as const satisfies ReadonlyArray<
  Exclude<ConversationalObjectiveId, 'none' | 'neutralContinuation'>
>;

/**
 * Optional pre-assembly / malformed fixture slot. Assembled plans store the
 * chosen prompt in `followUpQuestion` only; this field is read solely so a
 * malformed fixture that still carries both slots can prove specific
 * follow-up precedence without changing ConversationReplyPlan.
 */
type PlanWithOptionalContinuation = Readonly<ConversationReplyPlan> & {
  readonly continuationPrompt?: string | null;
};

function objectiveFromCatalogueWording(
  catalogueWording: string,
): ConversationalObjective | null {
  for (const id of SPECIFIC_FOLLOW_UP_IDS) {
    if (FOLLOW_UPS[id] === catalogueWording) {
      return { id, catalogueWording };
    }
  }
  if (FOLLOW_UPS.neutralContinuation === catalogueWording) {
    return { id: 'neutralContinuation', catalogueWording };
  }
  return null;
}

/**
 * Select the conversational objective already present on the reply plan.
 *
 * - specific follow-up present → that follow-up objective
 * - no specific follow-up and continuation present → continuation objective
 * - neither present → null
 */
export function selectConversationalObjective(
  plan: Readonly<ConversationReplyPlan>,
): ConversationalObjective | null {
  const planLike = plan as PlanWithOptionalContinuation;
  const followUpQuestion = plan.followUpQuestion;
  const continuationPrompt = planLike.continuationPrompt ?? null;

  if (followUpQuestion !== null) {
    return objectiveFromCatalogueWording(followUpQuestion);
  }

  if (continuationPrompt !== null) {
    return objectiveFromCatalogueWording(continuationPrompt);
  }

  return null;
}
