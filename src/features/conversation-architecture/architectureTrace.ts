/**
 * Architecture turn trace — diagnostic pipeline snapshot.
 *
 * Phase 4: Interpreter → Planner → Validator → Committer preview → Governor preview.
 * Behaviour switch remains OFF. Production governor remains behavioural owner.
 */

import { z } from 'zod';
import type { ConversationCoreState } from '../conversation-core';
import {
  clarificationFromOpenClarification,
  clarificationSchema,
} from './clarification';
import { choosePreviewConsultantAct } from './choosePreviewConsultantAct';
import { commitCanonicalOperations } from './commitCanonicalOperations';
import { plannerResultSchema } from './canonicalOperations';
import { interpretDiagnosticSemantic } from './interpretDiagnosticSemantic';
import { planCanonicalOperations } from './planCanonicalOperations';
import {
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
  phase: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  diagnosticOnly: z.literal(true),
  behaviourSwitchActive: z.literal(false),
  message: z.string(),
  stagesPresent: z.array(architectureStageSchema),
  activeClarification: clarificationSchema.nullable(),
  semantic: semanticInterpretationSchema,
  planner: plannerResultSchema,
  validation: validationResultSchema,
  committer: z.object({
    active: z.literal(false),
    appliedOperationCount: z.number().int().nonnegative(),
    note: z.string(),
    preview: travelPreviewSchema,
  }),
  governor: z.object({
    active: z.literal(false),
    note: z.string(),
    previewAct: z.object({
      kind: z.string(),
      reply: z.string(),
      askTopic: z.string().optional(),
      clarificationId: z.string().nullable(),
      confidence: z.number(),
    }),
  }),
  notes: z.array(z.string()),
});

export type ArchitectureStage = z.infer<typeof architectureStageSchema>;
export type ArchitectureTurnTrace = z.infer<typeof architectureTurnTraceSchema>;

export type BuildArchitectureTurnTraceInput = {
  message: string;
  currentState: ConversationCoreState;
  /** Optional injected semantic (tests). Otherwise diagnostic interpreter runs. */
  semantic?: SemanticInterpretation;
};

/**
 * Build a diagnostic architecture trace (full five-layer preview).
 * Never mutates input state; never overrides production acts.
 */
export function buildArchitectureTurnTrace(
  input: BuildArchitectureTurnTraceInput,
): ArchitectureTurnTrace {
  const activeClarification = clarificationFromOpenClarification(
    input.currentState.openClarification,
  );

  const semantic =
    input.semantic ??
    interpretDiagnosticSemantic({
      message: input.message,
      currentState: input.currentState,
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

  const previewAct = choosePreviewConsultantAct({
    previewState: committed.state,
    validation,
    semantic,
    clearedClarificationIds: committed.clearedClarificationIds,
    priorClarificationId: input.currentState.openClarification?.id ?? null,
  });

  return architectureTurnTraceSchema.parse({
    phase: 4,
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
      note: 'Phase 4: committer preview only — production writes still use existing governor path',
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
      note: 'Phase 4: preview act only — existing chooseConsultantAct owns production reply',
      previewAct: {
        kind: previewAct.kind,
        reply: previewAct.reply,
        askTopic: previewAct.askTopic,
        clarificationId: previewAct.clarification?.id ?? null,
        confidence: previewAct.confidence,
      },
    },
    notes: [
      'Architecture Phase 4 diagnostic dual-run path.',
      'No behaviour switch: production Turn Governor path unchanged.',
      'Preview commit/act are not assigned to result.state/reply.',
    ],
  });
}
