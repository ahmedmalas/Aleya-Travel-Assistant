/**
 * Turn contribution assembly — Situation-layer bridge into abstract value classes.
 *
 * Maps semantic delta *kinds* to ValueClass tags. Does not assign travel roles.
 * The Dialogue Reasoner only sees value classes + refs; the Planner reads payloads.
 */

import type { SemanticInterpretation } from '../semanticInterpretation';
import type { TurnContribution, ValueClass } from './dialogueTypes';

function valueClassesForDeltaKind(kind: string): ValueClass[] {
  switch (kind) {
    case 'mention_place':
    case 'add_place':
    case 'remove_place':
    case 'replace_place':
    case 'reorder_places':
      return ['PlaceLike'];
    case 'set_date':
    case 'set_duration_on_place':
      return ['TemporalLike'];
    case 'set_travellers':
      return ['QuantityLike'];
    case 'set_service':
      return ['ServiceLike'];
    case 'confirm_option':
      return ['OptionChoice', 'BooleanConfirm'];
    case 'reject_option':
    case 'reject_framing':
      return ['OptionChoice', 'BooleanConfirm'];
    case 'preserve_facet':
      return ['StructuredBundle'];
    default:
      return ['FreeText'];
  }
}

/**
 * Build opaque turn contributions from semantic deltas.
 */
export function buildTurnContributions(
  semantic: SemanticInterpretation,
): TurnContribution[] {
  return semantic.deltas.map((delta, deltaIndex) => ({
    id: `contrib:${deltaIndex}:${delta.kind}`,
    valueClasses: valueClassesForDeltaKind(delta.kind),
    payload: {
      deltaKind: delta.kind,
      deltaIndex,
      evidence: delta.evidence,
    },
    confidence: semantic.confidence,
  }));
}

export function contributionMatchesExpect(
  contribution: TurnContribution,
  expectValueClasses: ValueClass[],
): boolean {
  if (expectValueClasses.length === 0) return false;
  return contribution.valueClasses.some((vc) =>
    expectValueClasses.includes(vc),
  );
}
