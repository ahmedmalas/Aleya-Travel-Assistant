/**
 * Phase 4 — dual-run orchestration and divergence telemetry.
 *
 * Runs the five-layer diagnostic path in parallel with the legacy governor
 * outcome. Never overrides production state/reply.
 */

import { z } from 'zod';
import type { ConversationCoreState } from '../conversation-core';
import type { ConsultantAct } from '../conversation-consultant/types';
import {
  choosePreviewConsultantAct,
  type PreviewConsultantAct,
} from './choosePreviewConsultantAct';
import { commitCanonicalOperations } from './commitCanonicalOperations';
import { interpretDiagnosticSemantic } from './interpretDiagnosticSemantic';
import { planCanonicalOperations } from './planCanonicalOperations';
import {
  semanticInterpretationSchema,
  type SemanticInterpretation,
} from './semanticInterpretation';
import { validateCanonicalOperations } from './validateCanonicalOperations';
import { plannerResultSchema } from './canonicalOperations';
import { validationResultSchema } from './validationResult';

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
  phase: z.literal(4),
  diagnosticOnly: z.literal(true),
  behaviourSwitchActive: z.literal(false),
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
  // Map preview acknowledge/recover onto ask for coarse equality when both non-clarify.
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

  // Narrowing changes clarification id but not travel facts — treat as abstain.
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
  /** Optional injected semantic for deterministic corpus tests. */
  semantic?: SemanticInterpretation;
};

/**
 * Run the diagnostic five-layer path and compare to legacy governor output.
 */
export function runDualPathComparison(
  input: RunDualPathComparisonInput,
): DualRunComparison {
  const semantic =
    input.semantic ??
    interpretDiagnosticSemantic({
      message: input.message,
      currentState: input.priorState,
    });

  const planner = planCanonicalOperations({
    semantic,
    currentState: input.priorState,
  });

  const validation = validateCanonicalOperations({
    operations: planner.operations,
    currentState: input.priorState,
  });

  const committed = commitCanonicalOperations({
    currentState: input.priorState,
    accepted: validation.accepted,
    clarificationAction: validation.clarificationAction,
    narrowedClarification: validation.narrowedClarification,
  });

  const previewAct = choosePreviewConsultantAct({
    previewState: committed.state,
    validation,
    semantic,
    clearedClarificationIds: committed.clearedClarificationIds,
    priorClarificationId: input.priorState.openClarification?.id ?? null,
  });

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

  return dualRunComparisonSchema.parse({
    phase: 4,
    diagnosticOnly: true,
    behaviourSwitchActive: false,
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
  });
}
