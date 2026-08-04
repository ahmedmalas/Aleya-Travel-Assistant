/**
 * Phase 1 — Canonical Validator result schema.
 *
 * Phase 1 does not validate or accept operations; factories emit empty results
 * for diagnostic traces.
 */

import { z } from 'zod';
import { clarificationSchema } from './clarification';
import { proposedOperationSchema } from './canonicalOperations';

export const clarificationActionSchema = z.enum([
  'keep',
  'clear',
  'narrow',
  'supersede',
  'none',
]);

export const rejectedOperationSchema = z.object({
  op: proposedOperationSchema,
  reason: z.string(),
});

export const validationResultSchema = z.object({
  accepted: z.array(proposedOperationSchema),
  rejected: z.array(rejectedOperationSchema),
  clarificationNeeded: z.boolean(),
  clarificationAction: clarificationActionSchema,
  narrowedClarification: clarificationSchema.nullable(),
  reasons: z.array(z.string()),
});

export type ClarificationAction = z.infer<typeof clarificationActionSchema>;
export type RejectedOperation = z.infer<typeof rejectedOperationSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;

export function emptyValidationResult(
  overrides: Partial<ValidationResult> = {},
): ValidationResult {
  return validationResultSchema.parse({
    accepted: [],
    rejected: [],
    clarificationNeeded: false,
    clarificationAction: 'none',
    narrowedClarification: null,
    reasons: ['Phase 1: validator behaviour not active — empty result'],
    ...overrides,
  });
}
