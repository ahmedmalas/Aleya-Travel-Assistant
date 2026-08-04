/**
 * Architecture turn trace — diagnostic pipeline snapshot.
 *
 * Phase 2: pure Intent Planner runs inside the trace for inspection.
 * Behaviour switch remains OFF. Validator/Committer inactive.
 */

import { z } from 'zod';
import type { ConversationCoreState } from '../conversation-core';
import {
  clarificationFromOpenClarification,
  clarificationSchema,
} from './clarification';
import { plannerResultSchema } from './canonicalOperations';
import { planCanonicalOperations } from './planCanonicalOperations';
import {
  emptySemanticInterpretationResult,
  semanticInterpretationSchema,
  type SemanticInterpretation,
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
  /** Highest completed architecture phase reflected in this trace. */
  phase: z.union([z.literal(1), z.literal(2)]),
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
    active: z.literal(false),
    appliedOperationCount: z.literal(0),
    note: z.string(),
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
   * Optional semantic payload. When provided, Phase 2 planner runs purely
   * for the diagnostic trace. When omitted, an empty stub is planned.
   */
  semantic?: SemanticInterpretation;
};

/**
 * Build a diagnostic architecture trace.
 *
 * - Projects live `openClarification` into the generic Clarification schema.
 * - Runs the pure Intent Planner when semantic input is available.
 * - Validator and Committer remain inactive stubs.
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
        'Semantic interpreter behaviour not active — stub recorded for trace',
      ],
    });

  // Phase 2: pure planner — proposals only, no state writes.
  const planner = planCanonicalOperations({
    semantic,
    currentState: input.currentState,
  });

  const validation = emptyValidationResult({
    clarificationNeeded: activeClarification?.blocking === true,
    clarificationAction: activeClarification?.blocking ? 'keep' : 'none',
    reasons: [
      'Phase 2: validator behaviour not active — empty result',
      activeClarification?.blocking
        ? 'Blocking clarification present on state (projected only)'
        : 'No blocking clarification',
    ],
  });

  return architectureTurnTraceSchema.parse({
    phase: 2,
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
      note: 'Phase 2: state committer not active — canonical writes use existing governor path',
    },
    governor: {
      active: false,
      note: 'Phase 2: architecture governor not active — existing chooseConsultantAct path unchanged',
    },
    notes: [
      'Architecture Phase 2 diagnostic trace: pure Intent Planner active for inspection only.',
      'No behaviour switch: production Turn Governor path unchanged.',
      'Validator and Committer remain inactive.',
      'Planner proposals are not applied to canonical state.',
    ],
  });
}
