/**
 * Phase 1 — SemanticInterpretation schema (meaning only).
 *
 * Describes what the user means. Must not encode canonical mutations.
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
]);

export const conversationalControlSchema = z.enum([
  'none',
  'undo',
  'reset',
  'restart',
  'preserve_rest',
  'change_only',
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
