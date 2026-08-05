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
    case 'relation_route_via':
    case 'relation_transit':
    case 'relation_stopover':
    case 'relation_itinerary_stop':
    case 'relation_prefer_hub':
    case 'relation_avoid_place':
    case 'relation_routing_ambiguous':
      return ['PlaceLike'];
    case 'set_date':
    case 'set_duration_on_place':
      return ['TemporalLike'];
    case 'set_travellers':
      return ['QuantityLike'];
    case 'set_service':
      return ['ServiceLike'];
    case 'confirm_option':
    case 'control_confirm_plan':
      return ['OptionChoice', 'BooleanConfirm'];
    case 'reject_option':
    case 'reject_framing':
    case 'control_reject_plan':
      return ['OptionChoice', 'BooleanConfirm'];
    case 'preserve_facet':
    case 'relation_compare_optimise':
      return ['StructuredBundle'];
    case 'control_information_complete':
    case 'control_request_summary':
    case 'control_ready_to_proceed':
    case 'control_decline_further':
      return ['FreeText', 'BooleanConfirm'];
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
