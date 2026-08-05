/**
 * Dialogue layer public surface.
 */

export type {
  ValueClass,
  DialogueMoveKind,
  DialogueThreadKind,
  ObligationStatus,
  DomainSealedPayload,
  DialogueObligation,
  DialogueLastMove,
  DialogueThread,
  DialogueFocus,
  UnresolvedDialogueMatter,
  DialogueState,
  DialogueEvent,
  PlanningMode,
  ContributionPolicy,
  AmbiguityDisposition,
  ContributionRef,
  TurnContribution,
  DialogueDecision,
} from './dialogueTypes';

export {
  valueClassSchema,
  dialogueEventSchema,
  planningModeSchema,
} from './dialogueTypes';

export {
  createInitialDialogueState,
  cloneDialogueState,
  awaitingObligations,
  primaryAwaitingObligation,
} from './dialogueState';

export { buildTurnContributions, contributionMatchesExpect } from './turnContributions';

export {
  reasonDialogue,
  type ReasonDialogueInput,
} from './dialogueReasoner';

export {
  updateDialogueStateAfterAct,
  expectClassesAndDomainForAct,
  type UpdateDialogueStateInput,
} from './updateDialogueStateAfterAct';

export {
  resolveBoundDomainTarget,
  shouldUseEmptySlotResidual,
  isHoldDecision,
  boundContributionIds,
  type BoundDomainTarget,
} from './travelDomainBinding';
