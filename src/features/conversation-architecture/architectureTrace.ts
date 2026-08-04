/**
 * Architecture turn trace — diagnostic pipeline snapshot.
 *
 * Phase 3: Planner → Validator → Committer preview run for inspection only.
 * Behaviour switch remains OFF. Production governor remains behavioural owner.
 */

import { z } from 'zod';
import type { ConversationCoreState } from '../conversation-core';
import {
  clarificationFromOpenClarification,
  clarificationSchema,
} from './clarification';
import { commitCanonicalOperations } from './commitCanonicalOperations';
import { plannerResultSchema } from './canonicalOperations';
import { planCanonicalOperations } from './planCanonicalOperations';
import {
  emptySemanticInterpretationResult,
  semanticInterpretationSchema,
  type SemanticInterpretation,
} from './semanticInterpretation';
import { validateCanonicalOperations } from './validateCanonicalOperations';
import { validationResultSchema } from './validationResult';

export const architectureStageSchema = z.enum([
  'semantic_interpreter',
  'intent_planner',
  'canonical_validator',
  'state_committer',
  'consultant_governor',
]);

const travelPreviewSchema = z.object({
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  destinationStops: z.array(z.string()).nullable(),
  tripStructure: z.enum(['one_way', 'return', 'multi_city']).nullable(),
  tripLegs: z
    .array(
      z.object({
        origin: z.string().nullable(),
        destination: z.string().nullable(),
        departureDate: z.string().nullable(),
      }),
    )
    .nullable(),
  departureDate: z.string().nullable(),
  returnDate: z.string().nullable(),
  openClarificationId: z.string().nullable(),
  openClarificationParentId: z.string().nullable(),
  returnPoint: z.string().nullable(),
  clearedClarificationIds: z.array(z.string()),
});

export const architectureTurnTraceSchema = z.object({
  /** Highest completed architecture phase reflected in this trace. */
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** True when stages must not be treated as production-authoritative. */
  diagnosticOnly: z.literal(true),
  /** Behaviour switch is off — production path unchanged. */
  behaviourSwitchActive: z.literal(false),
  message: z.string(),
  stagesPresent: z.array(architectureStageSchema),
  activeClarification: clarificationSchema.nullable(),
  semantic: semanticInterpretationSchema,
  planner: plannerResultSchema,
  validation: validationResultSchema,
  committer: z.object({
    /** Architecture committer is not production-active. */
    active: z.literal(false),
    appliedOperationCount: z.number().int().nonnegative(),
    note: z.string(),
    /** Diagnostic preview only — not assigned to result.state. */
    preview: travelPreviewSchema,
  }),
  governor: z.object({
    active: z.literal(false),
    note: z.string(),
  }),
  notes: z.array(z.string()),
});

export type ArchitectureStage = z.infer<typeof architectureStageSchema>;
export type ArchitectureTurnTrace = z.infer<typeof architectureTurnTraceSchema>;

export type BuildArchitectureTurnTraceInput = {
  message: string;
  currentState: ConversationCoreState;
  /**
   * Optional semantic payload. When provided, Phase 2–3 pipeline runs purely
   * for the diagnostic trace. When omitted, an empty stub is planned.
   */
  semantic?: SemanticInterpretation;
};

/**
 * Build a diagnostic architecture trace.
 *
 * Runs planner → validator → committer preview on a copy.
 * Never mutates input state and never chooses consultant acts.
 * Production result.state / reply remain owned by the existing governor.
 */
export function buildArchitectureTurnTrace(
  input: BuildArchitectureTurnTraceInput,
): ArchitectureTurnTrace {
  const activeClarification = clarificationFromOpenClarification(
    input.currentState.openClarification,
  );

  const semantic =
    input.semantic ??
    emptySemanticInterpretationResult({
      ambiguityNotes: [
        'Semantic interpreter behaviour not active — stub recorded for trace',
      ],
    });

  const planner = planCanonicalOperations({
    semantic,
    currentState: input.currentState,
  });

  const validation = validateCanonicalOperations({
    operations: planner.operations,
    currentState: input.currentState,
  });

  const committed = commitCanonicalOperations({
    currentState: input.currentState,
    accepted: validation.accepted,
    clarificationAction: validation.clarificationAction,
    narrowedClarification: validation.narrowedClarification,
  });

  return architectureTurnTraceSchema.parse({
    phase: 3,
    diagnosticOnly: true,
    behaviourSwitchActive: false,
    message: input.message,
    stagesPresent: [
      'semantic_interpreter',
      'intent_planner',
      'canonical_validator',
      'state_committer',
      'consultant_governor',
    ],
    activeClarification,
    semantic,
    planner,
    validation,
    committer: {
      active: false,
      appliedOperationCount: committed.appliedOperationCount,
      note: 'Phase 3: committer preview only — production writes still use existing governor path',
      preview: {
        origin: committed.state.origin,
        destination: committed.state.destination,
        destinationStops: committed.state.destinationStops,
        tripStructure: committed.state.tripStructure,
        tripLegs: committed.state.tripLegs,
        departureDate: committed.state.departureDate,
        returnDate: committed.state.returnDate,
        openClarificationId: committed.state.openClarification?.id ?? null,
        openClarificationParentId:
          committed.state.openClarification?.parentClarificationId ?? null,
        returnPoint: committed.returnPoint,
        clearedClarificationIds: committed.clearedClarificationIds,
      },
    },
    governor: {
      active: false,
      note: 'Phase 3: architecture governor not active — existing chooseConsultantAct path unchanged',
    },
    notes: [
      'Architecture Phase 3 diagnostic trace: planner + validator + committer preview.',
      'No behaviour switch: production Turn Governor path unchanged.',
      'Committer preview is not assigned to result.state.',
      'Validator/Committer are not production-active.',
    ],
  });
}
