/**
 * Travel Domain Planner helpers for dialogue-constrained role binding.
 * Reads sealed domainTarget from obligations — Dialogue Reasoner never does.
 */

import type { DialogueDecision, DialogueState, TurnContribution } from './dialogueTypes';
import { primaryAwaitingObligation } from './dialogueState';

export type BoundDomainTarget =
  | 'origin'
  | 'destination'
  | 'destinationStops'
  | 'departureDate'
  | 'returnDate'
  | 'adultCount'
  | 'childCount'
  | 'infantCount'
  | 'services'
  | 'openClarification'
  | 'search_confirmation'
  | 'optional'
  | string;

/**
 * Resolve domain target for bound answer contributions from sealed obligation metadata.
 */
export function resolveBoundDomainTarget(
  dialogueState: DialogueState,
  decision: DialogueDecision,
): BoundDomainTarget | null {
  if (
    decision.planningMode !== 'apply_bound_contributions' &&
    decision.event !== 'answered_previous_move' &&
    decision.event !== 'compound_response'
  ) {
    // Still allow binding when satisfied ids present.
    if (decision.satisfiedObligationIds.length === 0) return null;
  }

  const id =
    decision.satisfiedObligationIds[0] ??
    primaryAwaitingObligation(dialogueState)?.id ??
    null;
  if (!id) return null;
  const obl = dialogueState.obligations.find((o) => o.id === id);
  const target = obl?.domainSealed?.domainTarget;
  return typeof target === 'string' ? target : null;
}

export function shouldUseEmptySlotResidual(decision: DialogueDecision): boolean {
  return (
    decision.event === 'no_prior_move' ||
    (decision.planningMode === 'apply_contributions_only' &&
      decision.event === 'ignored_move_with_contribution') ||
    (decision.planningMode === 'apply_contributions_only' &&
      decision.event === 'shifted_focus')
  );
}

export function isHoldDecision(decision: DialogueDecision): boolean {
  return (
    decision.planningMode === 'hold_for_clarification' ||
    decision.planningMode === 'no_domain_mutation'
  );
}

export function boundContributionIds(decision: DialogueDecision): Set<string> {
  return new Set(decision.boundContributionRefs.map((r) => r.id));
}

export function findContribution(
  contributions: TurnContribution[],
  id: string,
): TurnContribution | undefined {
  return contributions.find((c) => c.id === id);
}
