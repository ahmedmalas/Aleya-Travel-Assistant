/**
 * SemanticInterpretation schema (meaning only).
 *
 * Describes what the user means. Must not encode canonical mutations.
 * Includes travel-relation and conversational-control capability families.
 */

import { z } from 'zod';
import { referencedEntitySchema } from './clarification';

export const semanticIntentSchema = z.enum([
  'inform',
  'correct',
  'confirm',
  'reject',
  'add',
  'remove',
  'reorder',
  'replace_route',
  'preserve',
  'undo',
  'reset',
  'restart',
  'clarify_answer',
  'conversational_control',
  'unknown',
]);

/**
 * Delta kinds — entity mentions, travel relations (strategy), and control acts.
 * Relation kinds express journey strategy meaning; they do not commit writes.
 */
export const semanticDeltaKindSchema = z.enum([
  'mention_place',
  'remove_place',
  'reorder_places',
  'replace_place',
  'add_place',
  'set_duration_on_place',
  'set_date',
  'set_travellers',
  'set_service',
  'preserve_facet',
  'confirm_option',
  'reject_option',
  'reject_framing',
  'control_reset',
  'control_restart',
  'control_undo',
  'control_keep_rest',
  // Travel relationship / strategy (meaning only).
  'relation_route_via',
  'relation_transit',
  'relation_stopover',
  'relation_itinerary_stop',
  'relation_prefer_hub',
  'relation_avoid_place',
  'relation_routing_ambiguous',
  'relation_compare_optimise',
  // Conversational control (meaning only — never auto-executes search).
  'control_information_complete',
  'control_request_summary',
  'control_ready_to_proceed',
  'control_decline_further',
  'control_confirm_plan',
  'control_reject_plan',
]);

/**
 * Conversational control channel — orthogonal to place/date facts.
 * `information_complete` means gathering finished; Governor decides next act.
 */
export const conversationalControlSchema = z.enum([
  'none',
  'undo',
  'reset',
  'restart',
  'preserve_rest',
  'change_only',
  'information_complete',
  'request_summary',
  'ready_to_proceed',
  'decline_further_questions',
  'confirm_plan',
  'reject_plan',
]);

export const clarificationStanceSchema = z.enum([
  'none',
  'answers',
  'corrects_premise',
  'replaces_facts',
  'supplies_new_route',
  'rejects_choices',
  'narrows',
  'unrelated',
  'ambiguous',
]);

/** Typed payload for travel-relation deltas (optional; entities carry places). */
export const travelRelationValueSchema = z.object({
  relationFamily: z.enum([
    'route_via',
    'transit',
    'stopover',
    'itinerary_stop',
    'prefer_hub',
    'avoid',
    'routing_or_stopover_unresolved',
    'compare_optimise',
  ]),
  /** When unresolved, lists candidate readings without choosing one. */
  unresolvedBetween: z
    .array(z.enum(['transit', 'stopover', 'route_via']))
    .optional(),
  optimisationAxis: z
    .enum(['cheapest', 'fastest', 'convenient', 'unspecified'])
    .optional(),
});

export const conversationalControlValueSchema = z.object({
  controlFamily: z.enum([
    'information_complete',
    'request_summary',
    'ready_to_proceed',
    'decline_further_questions',
    'confirm_plan',
    'reject_plan',
  ]),
  /** Explicit: completion never implies search execution. */
  executesSearch: z.literal(false).optional(),
});

export const semanticDeltaSchema = z.object({
  kind: semanticDeltaKindSchema,
  entities: z.array(referencedEntitySchema),
  value: z.unknown().nullable(),
  evidence: z.string(),
});

export const semanticInterpretationSchema = z.object({
  intent: semanticIntentSchema,
  deltas: z.array(semanticDeltaSchema),
  conversationalControl: conversationalControlSchema,
  clarificationStance: clarificationStanceSchema,
  confidence: z.number().min(0).max(1),
  evidenceSummary: z.array(z.string()),
  ambiguityNotes: z.array(z.string()),
});

export type SemanticIntent = z.infer<typeof semanticIntentSchema>;
export type SemanticDeltaKind = z.infer<typeof semanticDeltaKindSchema>;
export type ConversationalControl = z.infer<typeof conversationalControlSchema>;
export type ClarificationStance = z.infer<typeof clarificationStanceSchema>;
export type SemanticDelta = z.infer<typeof semanticDeltaSchema>;
export type SemanticInterpretation = z.infer<typeof semanticInterpretationSchema>;
export type TravelRelationValue = z.infer<typeof travelRelationValueSchema>;
export type ConversationalControlValue = z.infer<
  typeof conversationalControlValueSchema
>;

export function emptySemanticInterpretationResult(
  overrides: Partial<SemanticInterpretation> = {},
): SemanticInterpretation {
  return semanticInterpretationSchema.parse({
    intent: 'unknown',
    deltas: [],
    conversationalControl: 'none',
    clarificationStance: 'none',
    confidence: 0,
    evidenceSummary: [],
    ambiguityNotes: [],
    ...overrides,
  });
}
