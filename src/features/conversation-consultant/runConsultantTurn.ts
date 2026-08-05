import {
  architectureStateUpdateFromCommit,
  buildArchitectureTurnTrace,
  buildGovernorTurnDiagnostics,
  consultantActFromPreview,
  isArchitectureBehaviourSwitchActive,
  runDualPathComparisonBundle,
  updateDialogueStateAfterAct,
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
import { applyConversationStateUpdate } from '../conversation-core/applyConversationStateUpdate';
import { interpretTravelUtterance } from '../conversation-interpretation';
import type { InterpretTravelUtteranceInput } from '../conversation-interpretation/types';
import {
  buildSituationModel,
  blockingAmbiguity,
  clarificationFromAmbiguity,
} from './buildSituationModel';
import { chooseConsultantAct } from './chooseConsultantAct';
import { commitUnambiguousFacts } from './commitUnambiguousFacts';
import { renderConsultantReply } from './renderConsultantReply';
import type { ConsultantAct, SituationModel } from './types';

export type RunConsultantTurnInput = {
  message: string;
  state: ConversationCoreState;
  userEntryId: string;
  assistantEntryId: string;
  userMessageAt: Date;
  assistantMessageAt: Date;
  /** Interpretation mode — default auto (AI → offline → regex). */
  interpretationMode?: InterpretTravelUtteranceInput['mode'];
  now?: Date;
  /**
   * Phase 5 — override behaviour switch for tests.
   * When omitted, reads VITE_ARCHITECTURE_GOVERNOR_SWITCH.
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
  dualRunComparison: DualRunComparison;
  /** Phase 5 — true only when switch requested AND gates passed for this turn. */
  behaviourSwitchActive: boolean;
  /** Phase 5 — whether Preview/env requested architecture ownership. */
  behaviourSwitchRequested: boolean;
  /** Phase 5 — visible activation diagnostics (never silent). */
  governorDiagnostics: GovernorTurnDiagnostics;
  /** Dialogue Layer — conversational decision for this turn. */
  dialogueDecision: DialogueDecision;
  /** Dialogue Layer — state after governor move. */
  dialogueState: DialogueState;
};

/**
 * Consultant Turn Governor.
 *
 * Always computes the legacy path and the architecture dual-run.
 * When VITE_ARCHITECTURE_GOVERNOR_SWITCH=true and activation gates pass,
 * architecture committer + preview governor own result.state / result.reply
 * for that turn (Draft preview only). Otherwise legacy remains authoritative.
 */
export async function runConsultantTurn(
  input: RunConsultantTurnInput,
): Promise<RunConsultantTurnResult> {
  const previousState = input.state;
  const switchRequested =
    input.behaviourSwitchRequested ?? isArchitectureBehaviourSwitchActive();

  const interpretation = await interpretTravelUtterance({
    message: input.message,
    currentState: previousState,
    recentHistory: previousState.transcript,
    mode: input.interpretationMode ?? 'auto',
    now: input.now,
  });

  const situation = buildSituationModel({
    message: input.message,
    currentState: previousState,
    interpretation,
  });

  const ambiguity = blockingAmbiguity(situation);
  const clarification =
    ambiguity !== null ? clarificationFromAmbiguity(ambiguity) : undefined;

  let stateUpdate = commitUnambiguousFacts({
    situation,
    currentState: previousState,
    openClarification:
      clarification !== undefined
        ? clarification
        : situation.facts.openClarification === null
          ? null
          : undefined,
  });

  const provisionalTravel = applyConversationStateUpdate(
    previousState,
    stateUpdate,
  );
  const provisionalState: ConversationCoreState = {
    ...previousState,
    ...provisionalTravel,
  };

  let act = chooseConsultantAct({
    situation,
    state: provisionalState,
  });

  if (act.kind === 'clarify' && act.clarification) {
    stateUpdate = {
      ...stateUpdate,
      openClarification: act.clarification,
    };
  }

  if (act.kind !== 'clarify' && provisionalState.openClarification === null) {
    stateUpdate = {
      ...stateUpdate,
      openClarification: null,
    };
  }

  if (act.kind === 'summarise' && situation.intent === 'complete') {
    stateUpdate = {
      ...stateUpdate,
      conversationComplete: true,
    };
  }
  if (act.kind === 'execute') {
    stateUpdate = {
      ...stateUpdate,
      conversationComplete: true,
      searchExecutionRequested: true,
      openClarification: null,
    };
  }

  const finalTravel = applyConversationStateUpdate(previousState, stateUpdate);
  const stateForReply: ConversationCoreState = {
    ...previousState,
    ...finalTravel,
  };

  const legacyReply = renderConsultantReply({
    act,
    situation,
    state: stateForReply,
    previousState,
  });

  const legacyResult = processConversationTurn({
    message: input.message,
    state: previousState,
    userEntryId: input.userEntryId,
    assistantEntryId: input.assistantEntryId,
    userMessageAt: input.userMessageAt,
    assistantMessageAt: input.assistantMessageAt,
    stateUpdate,
    skipExtraction: true,
    replyOverride: legacyReply,
  });

  const { comparison, pipeline, gates } = runDualPathComparisonBundle({
    message: input.message,
    priorState: previousState,
    legacyState: legacyResult.state,
    legacyReply: legacyResult.reply,
    legacyAct: act,
    behaviourSwitchRequested: switchRequested,
  });

  const behaviourSwitchActive = switchRequested && gates.mayActivate;

  const architectureTrace = buildArchitectureTurnTrace({
    message: input.message,
    currentState: previousState,
    behaviourSwitchActive,
  });

  const governorDiagnostics = buildGovernorTurnDiagnostics({
    behaviourSwitchActive,
    dualRunComparison: comparison,
    switchRequested,
  });

  if (!behaviourSwitchActive) {
    const dialogueState = updateDialogueStateAfterAct({
      prior: pipeline.dialogueStatePrior,
      decision: pipeline.dialogueDecision,
      act: {
        kind: act.kind,
        reply: legacyResult.reply,
        askTopic: act.askTopic,
        clarification: act.clarification ?? null,
        confidence: act.confidence,
      },
      turnCount: previousState.turnCount + 1,
    });
    return {
      state: { ...legacyResult.state, dialogueState },
      reply: legacyResult.reply,
      situation,
      act,
      stateUpdate,
      architectureTrace,
      dualRunComparison: comparison,
      behaviourSwitchActive: false,
      behaviourSwitchRequested: switchRequested,
      governorDiagnostics,
      dialogueDecision: pipeline.dialogueDecision,
      dialogueState,
    };
  }

  // Phase 5 activation — architecture owns this turn (existing pipeline only).
  const archUpdate = architectureStateUpdateFromCommit(pipeline.committed.state);
  // Preview governor may synthesize a place-role clarification that the
  // committer intentionally did not write (role-ambiguous travel seed).
  if (
    pipeline.previewAct.clarification &&
    (archUpdate.openClarification === null ||
      archUpdate.openClarification === undefined)
  ) {
    archUpdate.openClarification = pipeline.previewAct.clarification;
  }
  const archAct = consultantActFromPreview(pipeline.previewAct);
  const archReply = pipeline.previewAct.reply;

  const archResult = processConversationTurn({
    message: input.message,
    state: previousState,
    userEntryId: input.userEntryId,
    assistantEntryId: input.assistantEntryId,
    userMessageAt: input.userMessageAt,
    assistantMessageAt: input.assistantMessageAt,
    stateUpdate: archUpdate,
    skipExtraction: true,
    replyOverride: archReply,
  });

  return {
    state: {
      ...archResult.state,
      dialogueState: pipeline.dialogueStateNext,
    },
    reply: archResult.reply,
    situation,
    act: archAct,
    stateUpdate: archUpdate,
    architectureTrace,
    dualRunComparison: comparison,
    behaviourSwitchActive: true,
    behaviourSwitchRequested: switchRequested,
    governorDiagnostics,
    dialogueDecision: pipeline.dialogueDecision,
    dialogueState: pipeline.dialogueStateNext,
  };
}
