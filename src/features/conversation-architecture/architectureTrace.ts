/**
 * Architecture turn trace — diagnostic pipeline snapshot.
 *
 * Phase 4/5: Interpreter → Dialogue → Planner → Validator → Committer → Governor.
 */

import { z } from 'zod';
import type { ConversationCoreState } from '../conversation-core';
import {
  clarificationFromOpenClarification,
  clarificationSchema,
} from './clarification';
import { plannerResultSchema } from './canonicalOperations';
import { runArchitecturePipeline } from './runArchitecturePipeline';
import {
  semanticInterpretationSchema,
  type SemanticInterpretation,
} from './semanticInterpretation';
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
  phase: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  diagnosticOnly: z.boolean(),
  behaviourSwitchActive: z.boolean(),
  message: z.string(),
  stagesPresent: z.array(architectureStageSchema),
  activeClarification: clarificationSchema.nullable(),
  semantic: semanticInterpretationSchema,
  planner: plannerResultSchema,
  validation: validationResultSchema,
  committer: z.object({
    active: z.boolean(),
    appliedOperationCount: z.number().int().nonnegative(),
    note: z.string(),
    preview: travelPreviewSchema,
  }),
  governor: z.object({
    active: z.boolean(),
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
  /** When true, marks committer/governor as active in the trace (Phase 5). */
  behaviourSwitchActive?: boolean;
};

/**
 * Build a diagnostic architecture trace (full five-layer preview).
 * Never mutates input state; never overrides production acts.
 */
export function buildArchitectureTurnTrace(
  input: BuildArchitectureTurnTraceInput,
): ArchitectureTurnTrace {
  const pipeline = runArchitecturePipeline({
    message: input.message,
    currentState: input.currentState,
    semantic: input.semantic,
  });

  const {
    semantic,
    planner,
    validation,
    committed,
    previewAct,
    dialogueDecision,
  } = pipeline;

  const activeClarification = clarificationFromOpenClarification(
    input.currentState.openClarification,
  );

  const switchActive = input.behaviourSwitchActive === true;

  return architectureTurnTraceSchema.parse({
    phase: 5,
    diagnosticOnly: !switchActive,
    behaviourSwitchActive: switchActive,
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
      active: switchActive,
      appliedOperationCount: committed.appliedOperationCount,
      note: switchActive
        ? 'Phase 5: committer owns this turn (preview flag + gates passed)'
        : `Dialogue event=${dialogueDecision.event}; committer preview only`,
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
      active: switchActive,
      note: switchActive
        ? 'Phase 5: architecture governor owns this turn reply'
        : 'Phase 5: preview act only — legacy chooseConsultantAct owns reply unless switch+gates',
      previewAct: {
        kind: previewAct.kind,
        reply: previewAct.reply,
        askTopic: previewAct.askTopic,
        clarificationId: previewAct.clarification?.id ?? null,
        confidence: previewAct.confidence,
      },
    },
    notes: [
      'Architecture Phase 5 promotion-readiness path with Dialogue Layer.',
      `Dialogue event=${dialogueDecision.event}; planningMode=${dialogueDecision.planningMode}`,
      switchActive
        ? 'Behaviour switch ACTIVE for this turn (reversible preview flag + gates).'
        : 'Behaviour switch inactive for this turn — legacy owns result.state/reply.',
    ],
  });
}
