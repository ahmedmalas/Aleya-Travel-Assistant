/**
 * Canonical Validator result schema.
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
    reasons: ['Empty validation result factory'],
    ...overrides,
  });
}
