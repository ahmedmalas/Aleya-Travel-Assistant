/**
 * Phase 4/5 — dual-run orchestration and divergence telemetry.
 *
 * Phase 5: when the reversible behaviour switch is on AND activation gates
 * pass, the caller may promote architecture preview to result.state/reply.
 * This module still only builds comparison telemetry.
 */

import { z } from 'zod';
import type { ConversationCoreState } from '../conversation-core';
import type { ConsultantAct } from '../conversation-consultant/types';
import type { PreviewConsultantAct } from './choosePreviewConsultantAct';
import {
  runArchitecturePipeline,
  type ArchitecturePipelineResult,
} from './runArchitecturePipeline';
import {
  semanticInterpretationSchema,
  type SemanticInterpretation,
} from './semanticInterpretation';
import { plannerResultSchema } from './canonicalOperations';
import { validationResultSchema } from './validationResult';
import {
  evaluateActivationGates,
  type ActivationGateReport,
} from './activationGates';

export const divergenceCategorySchema = z.enum([
  'same_state_same_act',
  'same_state_different_act',
  'different_state_same_act',
  'different_state_different_act',
  'new_path_abstained',
  'legacy_loop_risk',
  'unsafe_new_path_blocked',
]);

export type DivergenceCategory = z.infer<typeof divergenceCategorySchema>;

const travelSnapshotSchema = z.object({
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  destinationStops: z.array(z.string()).nullable(),
  tripStructure: z.enum(['one_way', 'return', 'multi_city']).nullable(),
  departureDate: z.string().nullable(),
  returnDate: z.string().nullable(),
  openClarificationId: z.string().nullable(),
  openClarificationPrompt: z.string().nullable(),
});

export const dualRunComparisonSchema = z.object({
  phase: z.union([z.literal(4), z.literal(5)]),
  diagnosticOnly: z.boolean(),
  behaviourSwitchActive: z.boolean(),
  behaviourSwitchRequested: z.boolean(),
  gatesPassed: z.boolean(),
  message: z.string(),
  semantic: semanticInterpretationSchema,
  planner: plannerResultSchema,
  validation: validationResultSchema,
  previewState: travelSnapshotSchema,
  clearedClarificationIds: z.array(z.string()),
  previewAct: z.object({
    kind: z.string(),
    reply: z.string(),
    askTopic: z.string().optional(),
    clarificationId: z.string().nullable(),
    confidence: z.number(),
  }),
  legacy: z.object({
    reply: z.string(),
    actKind: z.string(),
    clarificationId: z.string().nullable(),
    state: travelSnapshotSchema,
  }),
  divergence: divergenceCategorySchema,
  divergenceNotes: z.array(z.string()),
  gateResults: z.array(
    z.object({
      id: z.string(),
      passed: z.boolean(),
      detail: z.string(),
    }),
  ),
});

export type DualRunComparison = z.infer<typeof dualRunComparisonSchema>;

function snapshot(state: ConversationCoreState) {
  return {
    origin: state.origin,
    destination: state.destination,
    destinationStops: state.destinationStops,
    tripStructure: state.tripStructure,
    departureDate: state.departureDate,
    returnDate: state.returnDate,
    openClarificationId: state.openClarification?.id ?? null,
    openClarificationPrompt: state.openClarification?.prompt ?? null,
  };
}

function sameTravelState(
  a: ReturnType<typeof snapshot>,
  b: ReturnType<typeof snapshot>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameActKind(
  legacyKind: string,
  preview: PreviewConsultantAct,
): boolean {
  if (legacyKind === preview.kind) return true;
  if (
    (legacyKind === 'ask' || legacyKind === 'amend') &&
    (preview.kind === 'ask' ||
      preview.kind === 'acknowledge' ||
      preview.kind === 'recover')
  ) {
    return true;
  }
  return false;
}

export function classifyDivergence(input: {
  priorState: ConversationCoreState;
  legacyState: ConversationCoreState;
  legacyAct: ConsultantAct;
  previewState: ConversationCoreState;
  previewAct: PreviewConsultantAct;
  validationRejectedPlace: boolean;
  newPathOnlyNoOpOrNarrow: boolean;
  message: string;
}): { divergence: DivergenceCategory; notes: string[] } {
  const notes: string[] = [];
  const legacySnap = snapshot(input.legacyState);
  const previewSnap = snapshot(input.previewState);
  const stateSame = sameTravelState(legacySnap, previewSnap);
  const actSame = sameActKind(input.legacyAct.kind, input.previewAct);

  const priorClar = input.priorState.openClarification;
  const bareSubject =
    priorClar?.blocking === true &&
    asciiFold(input.message.replace(/[.!?]+$/g, '').trim()) ===
      asciiFold(priorClar.subject);

  if (
    bareSubject &&
    input.legacyAct.kind === 'clarify' &&
    input.legacyAct.clarification?.id === priorClar?.id &&
    input.legacyAct.clarification?.prompt === priorClar?.prompt
  ) {
    notes.push(
      'Legacy repeated identical clarification after bare subject answer',
    );
    return { divergence: 'legacy_loop_risk', notes };
  }

  if (input.validationRejectedPlace) {
    notes.push('Validator blocked one or more unsafe place mutations');
    return { divergence: 'unsafe_new_path_blocked', notes };
  }

  const travelFactsSame =
    legacySnap.origin === previewSnap.origin &&
    legacySnap.destination === previewSnap.destination &&
    JSON.stringify(legacySnap.destinationStops) ===
      JSON.stringify(previewSnap.destinationStops) &&
    legacySnap.tripStructure === previewSnap.tripStructure &&
    legacySnap.departureDate === previewSnap.departureDate &&
    legacySnap.returnDate === previewSnap.returnDate;

  if (
    input.newPathOnlyNoOpOrNarrow &&
    travelFactsSame &&
    input.previewAct.kind === 'clarify' &&
    Boolean(input.previewState.openClarification?.parentClarificationId)
  ) {
    notes.push('New path narrowed clarification without place commit');
    return { divergence: 'new_path_abstained', notes };
  }

  if (input.newPathOnlyNoOpOrNarrow && !stateSame) {
    notes.push('New path abstained from unsafe/ambiguous commits');
  }

  if (stateSame && actSame) {
    return { divergence: 'same_state_same_act', notes };
  }
  if (stateSame && !actSame) {
    notes.push(
      `Act differs: legacy=${input.legacyAct.kind} preview=${input.previewAct.kind}`,
    );
    return { divergence: 'same_state_different_act', notes };
  }
  if (!stateSame && actSame) {
    notes.push('Travel state differs; act kinds align coarsely');
    return { divergence: 'different_state_same_act', notes };
  }
  notes.push('Travel state and act both differ');
  return { divergence: 'different_state_different_act', notes };
}

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

export type RunDualPathComparisonInput = {
  message: string;
  priorState: ConversationCoreState;
  legacyState: ConversationCoreState;
  legacyReply: string;
  legacyAct: ConsultantAct;
  semantic?: SemanticInterpretation;
  /** Whether the reversible preview flag requested activation. */
  behaviourSwitchRequested?: boolean;
  /** Optional precomputed pipeline (avoids double work). */
  pipeline?: ArchitecturePipelineResult;
};

export type DualPathComparisonBundle = {
  comparison: DualRunComparison;
  pipeline: ArchitecturePipelineResult;
  gates: ActivationGateReport;
};

/**
 * Run the diagnostic five-layer path and compare to legacy governor output.
 */
export function runDualPathComparison(
  input: RunDualPathComparisonInput,
): DualRunComparison {
  return runDualPathComparisonBundle(input).comparison;
}

/**
 * Full dual-run bundle including pipeline + gate report for Phase 5 activation.
 */
export function runDualPathComparisonBundle(
  input: RunDualPathComparisonInput,
): DualPathComparisonBundle {
  const pipeline =
    input.pipeline ??
    runArchitecturePipeline({
      message: input.message,
      currentState: input.priorState,
      semantic: input.semantic,
    });

  const { semantic, planner, validation, committed, previewAct } = pipeline;

  const validationRejectedPlace = validation.rejected.some((r) =>
    /place|origin|destination|stop|Low confidence|refusing|out of range|not found|Undo rejected|unsafe/i.test(
      `${r.op.op} ${r.reason}`,
    ),
  );

  const newPathOnlyNoOpOrNarrow = validation.accepted.every(
    (o) =>
      o.op === 'no_state_change' ||
      o.op === 'narrow_clarification' ||
      o.op === 'reject_clarification' ||
      o.op.startsWith('preserve_'),
  );

  const { divergence, notes } = classifyDivergence({
    priorState: input.priorState,
    legacyState: input.legacyState,
    legacyAct: input.legacyAct,
    previewState: committed.state,
    previewAct,
    validationRejectedPlace,
    newPathOnlyNoOpOrNarrow,
    message: input.message,
  });

  const comparisonBase = {
    phase: 5 as const,
    diagnosticOnly: true,
    behaviourSwitchActive: false,
    behaviourSwitchRequested: input.behaviourSwitchRequested ?? false,
    gatesPassed: false,
    message: input.message,
    semantic,
    planner,
    validation,
    previewState: snapshot(committed.state),
    clearedClarificationIds: committed.clearedClarificationIds,
    previewAct: {
      kind: previewAct.kind,
      reply: previewAct.reply,
      askTopic: previewAct.askTopic,
      clarificationId: previewAct.clarification?.id ?? null,
      confidence: previewAct.confidence,
    },
    legacy: {
      reply: input.legacyReply,
      actKind: input.legacyAct.kind,
      clarificationId: input.legacyAct.clarification?.id ?? null,
      state: snapshot(input.legacyState),
    },
    divergence,
    divergenceNotes: notes,
    gateResults: [] as Array<{ id: string; passed: boolean; detail: string }>,
  };

  // Temporary object for gate evaluation before final parse.
  const gates = evaluateActivationGates({
    comparison: comparisonBase as DualRunComparison,
    priorState: input.priorState,
  });

  const switchRequested = input.behaviourSwitchRequested ?? false;
  const behaviourSwitchActive = switchRequested && gates.mayActivate;

  const comparison = dualRunComparisonSchema.parse({
    ...comparisonBase,
    diagnosticOnly: !behaviourSwitchActive,
    behaviourSwitchActive,
    behaviourSwitchRequested: switchRequested,
    gatesPassed: gates.allPassed,
    gateResults: gates.results,
  });

  return { comparison, pipeline, gates };
}
