/**
 * Phase 1 — diagnostic architecture turn trace.
 *
 * Inspectable pipeline snapshot. Does not drive commits, acts, or UI.
 */

import { z } from 'zod';
import type { ConversationCoreState } from '../conversation-core';
import {
  clarificationFromOpenClarification,
  clarificationSchema,
} from './clarification';
import {
  emptyPlannerResult,
  plannerResultSchema,
} from './canonicalOperations';
import {
  emptySemanticInterpretationResult,
  semanticInterpretationSchema,
} from './semanticInterpretation';
import {
  emptyValidationResult,
  validationResultSchema,
} from './validationResult';

export const architectureStageSchema = z.enum([
  'semantic_interpreter',
  'intent_planner',
  'canonical_validator',
  'state_committer',
  'consultant_governor',
]);

export const architectureTurnTraceSchema = z.object({
  /** Schema/pipeline phase that produced this trace. */
  phase: z.literal(1),
  /** True when stages are stubs and must not be treated as authoritative. */
  diagnosticOnly: z.literal(true),
  /** Behaviour switch is off — production path unchanged. */
  behaviourSwitchActive: z.literal(false),
  message: z.string(),
  stagesPresent: z.array(architectureStageSchema),
  activeClarification: clarificationSchema.nullable(),
  semantic: semanticInterpretationSchema,
  planner: plannerResultSchema,
  validation: validationResultSchema,
  /**
   * Committer is not active in Phase 1. Always records that no commit
   * was performed by the architecture pipeline.
   */
  committer: z.object({
    active: z.literal(false),
    appliedOperationCount: z.literal(0),
    note: z.string(),
  }),
  /**
   * Governor act is chosen by the existing Turn Governor, not this pipeline.
   * Trace records a placeholder for stage presence only.
   */
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
   * Optional Phase 1 semantic payload for inspection. When omitted, an empty
   * unknown interpretation is recorded (planner/validator still inactive).
   */
  semantic?: ReturnType<typeof emptySemanticInterpretationResult>;
};

/**
 * Build a Phase 1 diagnostic trace.
 *
 * - Projects live `openClarification` into the generic Clarification schema.
 * - Records empty planner/validator results (behaviour not implemented).
 * - Never mutates canonical state and never chooses consultant acts.
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
        'Phase 1: semantic interpreter behaviour not active — stub recorded',
      ],
    });

  const planner = emptyPlannerResult({
    clarificationStance: semantic.clarificationStance,
    reasoningTrace: [
      'Phase 1: planner behaviour not active — empty proposal',
      activeClarification
        ? `Active clarification projected for diagnostics: ${activeClarification.id}`
        : 'No active clarification on canonical state',
    ],
  });

  const validation = emptyValidationResult({
    clarificationNeeded: activeClarification?.blocking === true,
    clarificationAction: activeClarification?.blocking ? 'keep' : 'none',
    reasons: [
      'Phase 1: validator behaviour not active — empty result',
      activeClarification?.blocking
        ? 'Blocking clarification present on state (projected only)'
        : 'No blocking clarification',
    ],
  });

  return architectureTurnTraceSchema.parse({
    phase: 1,
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
      appliedOperationCount: 0,
      note: 'Phase 1: state committer not active — canonical writes use existing governor path',
    },
    governor: {
      active: false,
      note: 'Phase 1: architecture governor not active — existing chooseConsultantAct path unchanged',
    },
    notes: [
      'Architecture Phase 1 diagnostic trace only.',
      'No behaviour switch: production Turn Governor path unchanged.',
      'No planner, validator, or committer side effects.',
    ],
  });
}
