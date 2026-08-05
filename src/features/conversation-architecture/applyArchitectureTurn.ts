/**
 * Phase 5 — apply architecture committer preview + governor preview as the
 * turn outcome. Used only when the behaviour switch is on AND gates pass.
 */

import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from '../conversation-core';
import type { ConsultantAct, ConsultantAskTopic } from '../conversation-consultant/types';
import type { PreviewConsultantAct } from './choosePreviewConsultantAct';
import type { CommitCanonicalOperationsResult } from './commitCanonicalOperations';

/**
 * Build an explicit ConversationStateUpdate that projects architecture
 * committed travel fields onto the processConversationTurn boundary.
 */
export function architectureStateUpdateFromCommit(
  committed: ConversationCoreState,
): ConversationStateUpdate {
  return {
    origin: committed.origin,
    destination: committed.destination,
    destinationStops: committed.destinationStops,
    tripStructure: committed.tripStructure,
    tripLegs: committed.tripLegs,
    departureDate: committed.departureDate,
    returnDate: committed.returnDate,
    adultCount: committed.adultCount,
    childCount: committed.childCount,
    infantCount: committed.infantCount,
    flightsRequested: committed.flightsRequested,
    accommodationRequested: committed.accommodationRequested,
    carHireRequested: committed.carHireRequested,
    activitiesRequested: committed.activitiesRequested,
    restaurantsRequested: committed.restaurantsRequested,
    restaurantPreference: committed.restaurantPreference,
    conversationComplete: committed.conversationComplete,
    searchExecutionRequested: committed.searchExecutionRequested,
    amendmentResumeSearchReady: committed.amendmentResumeSearchReady,
    openClarification: committed.openClarification,
    destinationResolutionStatus: committed.destinationResolutionStatus,
    originResolutionStatus: committed.originResolutionStatus,
    dialogueState: committed.dialogueState,
  };
}

/**
 * Map preview act kinds onto production ConsultantAct kinds.
 * acknowledge → amend; recover → ask. No new act kinds on the wire.
 */
export function consultantActFromPreview(
  preview: PreviewConsultantAct,
): ConsultantAct {
  const kind: ConsultantAct['kind'] =
    preview.kind === 'acknowledge'
      ? 'amend'
      : preview.kind === 'recover'
        ? 'ask'
        : preview.kind;

  return {
    kind,
    reply: preview.reply,
    askTopic: preview.askTopic as ConsultantAskTopic | undefined,
    clarification: preview.clarification ?? undefined,
    confidence: preview.confidence,
  };
}

export type ArchitectureTurnApplication = {
  stateUpdate: ConversationStateUpdate;
  act: ConsultantAct;
  reply: string;
  committed: CommitCanonicalOperationsResult;
};
