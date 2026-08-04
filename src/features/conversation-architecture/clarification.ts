/**
 * Phase 1 — generic Clarification schema (architecture only).
 *
 * Extends the production `OpenClarification` shape for future domains.
 * Not yet written to canonical state; used in diagnostic traces.
 */

import { z } from 'zod';
import type { OpenClarification } from '../conversation-core';

export const clarificationDomainSchema = z.enum([
  'location',
  'date',
  'traveller',
  'duration',
  'budget',
  'cabin',
  'baggage',
  'hotel',
  'transport',
  'activity',
  'visa',
  'loyalty',
  'correction',
  'generic',
]);

export const clarificationIssueTypeSchema = z.enum([
  'role_ambiguity',
  'reference_ambiguity',
  'conflict',
  'missing_value',
  'low_confidence',
  'unsupported_combo',
  'confirmation',
]);

export const clarificationStatusSchema = z.enum([
  'open',
  'answered',
  'corrected',
  'superseded',
  'rejected',
  'narrowed',
  'unresolved',
  'dismissed',
]);

export const referencedEntitySchema = z.object({
  surface: z.string(),
  resolvedHint: z.string().nullable(),
  entityKindHint: z.enum([
    'place',
    'date',
    'duration',
    'traveller',
    'service',
    'preference',
    'clarification_option',
    'stop_index',
    'route',
    'unknown',
  ]),
  indexHint: z.number().int().nullable(),
  deixis: z.enum(['there', 'that_one', 'it', 'the_same']).nullable(),
});

export const clarificationSchema = z.object({
  id: z.string(),
  domain: clarificationDomainSchema,
  issueType: clarificationIssueTypeSchema,
  subject: z.string(),
  prompt: z.string(),
  options: z.array(z.string()),
  referencedEntities: z.array(referencedEntitySchema),
  blocking: z.boolean(),
  status: clarificationStatusSchema,
  parentClarificationId: z.string().nullable(),
  attemptCount: z.number().int().nonnegative(),
  /** Ordered places when location role ambiguity is in scope (optional). */
  placesInOrder: z.array(z.string()).optional(),
});

export type ClarificationDomain = z.infer<typeof clarificationDomainSchema>;
export type ClarificationIssueType = z.infer<typeof clarificationIssueTypeSchema>;
export type ClarificationStatus = z.infer<typeof clarificationStatusSchema>;
export type ReferencedEntity = z.infer<typeof referencedEntitySchema>;
export type Clarification = z.infer<typeof clarificationSchema>;

export function emptyReferencedEntity(
  overrides: Partial<ReferencedEntity> = {},
): ReferencedEntity {
  return {
    surface: '',
    resolvedHint: null,
    entityKindHint: 'unknown',
    indexHint: null,
    deixis: null,
    ...overrides,
  };
}

/**
 * Project the live production OpenClarification into the Phase 1 Clarification
 * schema for diagnostic traces. Does not mutate canonical state.
 */
export function clarificationFromOpenClarification(
  open: OpenClarification | null | undefined,
): Clarification | null {
  if (open == null) return null;

  const domain: ClarificationDomain =
    open.type === 'place_role' || open.type === 'trip_structure'
      ? 'location'
      : open.type === 'date_anchor'
        ? 'date'
        : 'generic';

  const issueType: ClarificationIssueType =
    open.type === 'place_role'
      ? 'role_ambiguity'
      : open.type === 'trip_structure'
        ? 'conflict'
        : open.type === 'date_anchor'
          ? 'missing_value'
          : 'confirmation';

  const referencedEntities: ReferencedEntity[] = (open.placesInOrder ?? []).map(
    (place) =>
      emptyReferencedEntity({
        surface: place,
        resolvedHint: place,
        entityKindHint: 'place',
      }),
  );

  if (referencedEntities.length === 0 && open.subject) {
    referencedEntities.push(
      emptyReferencedEntity({
        surface: open.subject,
        resolvedHint: open.subject,
        entityKindHint: 'place',
      }),
    );
  }

  return clarificationSchema.parse({
    id: open.id,
    domain,
    issueType,
    subject: open.subject,
    prompt: open.prompt,
    options: open.options,
    referencedEntities,
    blocking: open.blocking,
    status: 'open',
    parentClarificationId: open.parentClarificationId ?? null,
    attemptCount: open.attemptCount ?? 1,
    placesInOrder: open.placesInOrder,
  });
}
