/**
 * Proposed canonical operations (planner output schema).
 *
 * Operations are proposals only until Validator + Committer are activated.
 */

import { z } from 'zod';

export const canonicalOperationKindSchema = z.enum([
  'set_origin',
  'replace_origin',
  'clear_origin',
  'set_destinations',
  'replace_destination',
  'add_destination',
  'remove_destination',
  'reorder_destinations',
  'set_return_point',
  'clear_return_point',
  'set_trip_structure',
  'set_leg_duration',
  'set_departure_date',
  'set_return_date',
  'clear_date',
  'set_traveller_count',
  'set_service',
  'set_preference',
  'preserve_dates',
  'preserve_travellers',
  'preserve_preferences',
  'preserve_places',
  'reset_trip',
  'restart_conversation',
  'undo_last_commit',
  'confirm_clarification',
  'reject_clarification',
  'supersede_clarification',
  'narrow_clarification',
  'no_state_change',
]);

export const resolvedEntityRoleSchema = z.enum([
  'origin',
  'destination',
  'stop',
  'return_point',
  'clarification_subject',
  'clarification_option',
  'unknown',
]);

export const proposedOperationSchema = z.object({
  op: canonicalOperationKindSchema,
  target: z.string(),
  value: z.unknown(),
  resolvedEntity: z.object({
    role: resolvedEntityRoleSchema,
    id: z.union([z.string(), z.number()]).nullable(),
  }),
  dependsOnClarification: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoningTrace: z.array(z.string()),
});

export const plannerResultSchema = z.object({
  operations: z.array(proposedOperationSchema),
  clarificationStance: z.enum([
    'none',
    'answers',
    'corrects_premise',
    'replaces_facts',
    'supplies_new_route',
    'rejects_choices',
    'narrows',
    'unrelated',
    'ambiguous',
  ]),
  reasoningTrace: z.array(z.string()),
});

export type CanonicalOperationKind = z.infer<typeof canonicalOperationKindSchema>;
export type ResolvedEntityRole = z.infer<typeof resolvedEntityRoleSchema>;
export type ProposedOperation = z.infer<typeof proposedOperationSchema>;
export type PlannerResult = z.infer<typeof plannerResultSchema>;

export function emptyPlannerResult(
  overrides: Partial<PlannerResult> = {},
): PlannerResult {
  return plannerResultSchema.parse({
    operations: [],
    clarificationStance: 'none',
    reasoningTrace: ['Empty planner result factory'],
    ...overrides,
  });
}
