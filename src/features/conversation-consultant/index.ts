/**
 * conversation-consultant — goal-driven Consultant Turn Governor.
 *
 * Authoritative production conversation path:
 * understand → commit unambiguous facts → clarify when needed → one act → reply.
 */

export type {
  ConsultantAct,
  ConsultantActKind,
  ConsultantAskTopic,
  ConsultantIntent,
  OpenClarification,
  SituationAmbiguity,
  SituationFacts,
  SituationHypothesis,
  SituationModel,
} from './types';

export {
  buildSituationModel,
  blockingAmbiguity,
  clarificationFromAmbiguity,
  resolvePlaceRoleClarification,
} from './buildSituationModel';
export { chooseConsultantAct, selectReadinessAskTopic } from './chooseConsultantAct';
export { commitUnambiguousFacts } from './commitUnambiguousFacts';
export { renderConsultantReply } from './renderConsultantReply';
export {
  runConsultantTurn,
  type RunConsultantTurnInput,
  type RunConsultantTurnResult,
} from './runConsultantTurn';

/** Phase 1 architecture schemas/traces — diagnostic only; behaviour switch off. */
export type { ArchitectureTurnTrace } from '../conversation-architecture';
