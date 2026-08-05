/**
 * Dialogue layer contracts — domain-agnostic conversational ownership.
 *
 * The Dialogue Reasoner must not import or reason about travel fields.
 * Domain targets are sealed on obligations for the Travel Domain Planner only.
 */

import { z } from 'zod';

/** Abstract value classes — never travel field names. */
export const valueClassSchema = z.enum([
  'PlaceLike',
  'TemporalLike',
  'QuantityLike',
  'BooleanConfirm',
  'OptionChoice',
  'ServiceLike',
  'StructureLike',
  'FreeText',
  'StructuredBundle',
]);

export type ValueClass = z.infer<typeof valueClassSchema>;

export const dialogueMoveKindSchema = z.enum([
  'ask',
  'clarify',
  'confirm',
  'summarise',
  'execute',
  'amend',
  'acknowledge',
  'recover',
]);

export type DialogueMoveKind = z.infer<typeof dialogueMoveKindSchema>;

export const dialogueThreadKindSchema = z.enum([
  'capture',
  'clarify',
  'confirm',
  'amend',
  'edit',
  'book',
  'idle',
]);

export type DialogueThreadKind = z.infer<typeof dialogueThreadKindSchema>;

export const obligationStatusSchema = z.enum([
  'awaiting',
  'satisfied',
  'deferred',
  'superseded',
]);

export type ObligationStatus = z.infer<typeof obligationStatusSchema>;

/**
 * Sealed domain metadata — opaque to the Dialogue Reasoner.
 * Travel Domain Planner alone interprets `domainTarget`.
 */
export type DomainSealedPayload = {
  domainTarget?: string;
  [key: string]: unknown;
};

export type DialogueObligation = {
  id: string;
  sourceMoveId: string;
  expectValueClasses: ValueClass[];
  status: ObligationStatus;
  /** Opaque to Dialogue Reasoner; Planner may read domainTarget. */
  domainSealed: DomainSealedPayload;
};

export type DialogueLastMove = {
  moveId: string;
  kind: DialogueMoveKind;
  expectValueClasses: ValueClass[];
  obligationId: string | null;
  promptFingerprint: string;
  issuedAtTurn: number;
};

export type DialogueThread = {
  threadId: string;
  kind: DialogueThreadKind;
  status: 'active' | 'suspended' | 'closed';
};

export type DialogueFocus = {
  handle: string;
  label?: string;
};

export type UnresolvedDialogueMatter = {
  id: string;
  kind: 'ambiguity' | 'rejected_direction' | 'unanswered_move' | 'recovery';
  relatedObligationIds: string[];
};

export type DialogueState = {
  lastMove: DialogueLastMove | null;
  openThread: DialogueThread;
  focus: DialogueFocus | null;
  obligations: DialogueObligation[];
  unresolvedDialogueMatters: UnresolvedDialogueMatter[];
};

export const dialogueEventSchema = z.enum([
  'answered_previous_move',
  'ignored_move_with_contribution',
  'corrected_premise',
  'amended_prior_information',
  'rejected_direction',
  'shifted_focus',
  'restarted',
  'confirmed',
  'declined',
  'compound_response',
  'ambiguous_relation',
  'no_prior_move',
]);

export type DialogueEvent = z.infer<typeof dialogueEventSchema>;

export const planningModeSchema = z.enum([
  'apply_bound_contributions',
  'apply_contributions_only',
  'apply_amendments',
  'apply_premise_correction',
  'apply_confirmation',
  'apply_decline',
  'apply_restart',
  'hold_for_clarification',
  'no_domain_mutation',
]);

export type PlanningMode = z.infer<typeof planningModeSchema>;

export const contributionPolicySchema = z.enum([
  'allow_additional_clear_facts',
  'disallow_unrelated_writes',
  'amendments_only',
  'bound_answers_preferred',
]);

export type ContributionPolicy = z.infer<typeof contributionPolicySchema>;

export const ambiguityDispositionSchema = z.enum([
  'none',
  'require_clarification',
  'require_recovery_prompt',
]);

export type AmbiguityDisposition = z.infer<typeof ambiguityDispositionSchema>;

export type ContributionRef = {
  id: string;
};

/**
 * Turn-local contribution assembled before the Reasoner.
 * Value classes are abstract; payloads stay opaque to the Reasoner.
 */
export type TurnContribution = {
  id: string;
  valueClasses: ValueClass[];
  /** Opaque payload for Planner (semantic delta index / kind / value). */
  payload: {
    deltaKind: string;
    deltaIndex: number;
    evidence: string;
  };
  confidence: number;
};

export type DialogueDecision = {
  event: DialogueEvent;
  confidence: number;
  satisfiedObligationIds: string[];
  deferredObligationIds: string[];
  supersededObligationIds: string[];
  planningMode: PlanningMode;
  contributionPolicy: ContributionPolicy;
  ambiguity: AmbiguityDisposition;
  boundContributionRefs: ContributionRef[];
  notes: string[];
};
