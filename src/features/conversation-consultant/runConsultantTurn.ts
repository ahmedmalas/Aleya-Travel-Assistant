import {
  architectureStateUpdateFromCommit,
  buildArchitectureTurnTraceFromPipeline,
  buildGovernorTurnDiagnostics,
  consultantActFromPreview,
  runArchitecturePipeline,
  type ArchitectureTurnTrace,
  type DialogueDecision,
  type DialogueState,
  type DualRunComparison,
  type GovernorTurnDiagnostics,
} from '../conversation-architecture';
import {
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../conversation-core';
import { interpretSemanticMeaning } from '../conversation-interpretation';
import { situationFromSemantic } from './situationFromSemantic';
import type { ConsultantAct, SituationModel } from './types';

export type RunConsultantTurnInput = {
  message: string;
  state: ConversationCoreState;
  userEntryId: string;
  assistantEntryId: string;
  userMessageAt: Date;
  assistantMessageAt: Date;
  /**
   * @deprecated Engine Consolidation — single SI owns meaning; mode is ignored.
   * Retained only so existing call sites compile.
   */
  interpretationMode?: string;
  now?: Date;
  /**
   * @deprecated Engine Consolidation — architecture path always owns the turn.
   * Retained for call-site / diagnostic field compatibility only.
   */
  behaviourSwitchRequested?: boolean;
};

export type RunConsultantTurnResult = {
  state: ConversationCoreState;
  reply: string;
  situation: SituationModel;
  act: ConsultantAct;
  stateUpdate: ConversationStateUpdate;
  architectureTrace: ArchitectureTurnTrace;
  /**
   * Identity telemetry from the single engine (no second path executed).
   * Field retained for existing diagnostic consumers.
   */
  dualRunComparison: DualRunComparison;
  /** Always true — single authoritative engine owns every turn. */
  behaviourSwitchActive: boolean;
  /** Always true after consolidation (single engine). */
  behaviourSwitchRequested: boolean;
  governorDiagnostics: GovernorTurnDiagnostics;
  dialogueDecision: DialogueDecision;
  dialogueState: DialogueState;
};

function travelSnapshot(state: ConversationCoreState) {
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

/**
 * Consultant Turn Governor — single authoritative engine.
 *
 * Semantic Interpretation
 * → SituationModel (projection of that semantic)
 * → Dialogue Reasoner
 * → Travel Domain Planner
 * → Canonical Validator
 * → Committer
 * → Consultant Governor
 * → Reply Renderer
 *
 * No legacy ITU / chooseConsultantAct / dual-run behavioural fork.
 */
export async function runConsultantTurn(
  input: RunConsultantTurnInput,
): Promise<RunConsultantTurnResult> {
  const previousState = input.state;

  // One semantic result for the whole turn.
  const semantic = interpretSemanticMeaning({
    message: input.message,
    currentState: previousState,
    now: input.now,
  });

  const situation = situationFromSemantic({
    message: input.message,
    semantic,
    currentState: previousState,
  });

  // One pipeline execution (SI reused — not re-run).
  const pipeline = runArchitecturePipeline({
    message: input.message,
    currentState: previousState,
    semantic,
    now: input.now,
  });

  const archUpdate = architectureStateUpdateFromCommit(pipeline.committed.state);
  if (
    pipeline.previewAct.clarification &&
    (archUpdate.openClarification === null ||
      archUpdate.openClarification === undefined)
  ) {
    archUpdate.openClarification = pipeline.previewAct.clarification;
  }

  const act = consultantActFromPreview(pipeline.previewAct);
  const reply = pipeline.previewAct.reply;

  const archResult = processConversationTurn({
    message: input.message,
    state: previousState,
    userEntryId: input.userEntryId,
    assistantEntryId: input.assistantEntryId,
    userMessageAt: input.userMessageAt,
    assistantMessageAt: input.assistantMessageAt,
    stateUpdate: archUpdate,
    skipExtraction: true,
    replyOverride: reply,
  });

  const nextState: ConversationCoreState = {
    ...archResult.state,
    dialogueState: pipeline.dialogueStateNext,
  };

  const snap = travelSnapshot(nextState);
  const dualRunComparison: DualRunComparison = {
    phase: 5,
    diagnosticOnly: false,
    behaviourSwitchActive: true,
    behaviourSwitchRequested: true,
    gatesPassed: true,
    message: input.message,
    semantic: pipeline.semantic,
    planner: pipeline.planner,
    validation: pipeline.validation,
    previewState: snap,
    clearedClarificationIds: pipeline.committed.clearedClarificationIds,
    previewAct: {
      kind: pipeline.previewAct.kind,
      reply: pipeline.previewAct.reply,
      askTopic: pipeline.previewAct.askTopic,
      clarificationId: pipeline.previewAct.clarification?.id ?? null,
      confidence: pipeline.previewAct.confidence,
    },
    // Identity — no second engine executed.
    legacy: {
      reply,
      actKind: act.kind,
      clarificationId: act.clarification?.id ?? null,
      state: snap,
    },
    divergence: 'same_state_same_act',
    divergenceNotes: [
      'Engine Consolidation: single authoritative path (no dual-run fork)',
    ],
    gateResults: [],
  };

  const architectureTrace = buildArchitectureTurnTraceFromPipeline({
    message: input.message,
    currentState: previousState,
    pipeline,
    behaviourSwitchActive: true,
  });

  const governorDiagnostics = buildGovernorTurnDiagnostics({
    behaviourSwitchActive: true,
    dualRunComparison,
    switchRequested: true,
  });

  return {
    state: nextState,
    reply,
    situation,
    act,
    stateUpdate: archUpdate,
    architectureTrace,
    dualRunComparison,
    behaviourSwitchActive: true,
    behaviourSwitchRequested: true,
    governorDiagnostics,
    dialogueDecision: pipeline.dialogueDecision,
    dialogueState: pipeline.dialogueStateNext,
  };
}
