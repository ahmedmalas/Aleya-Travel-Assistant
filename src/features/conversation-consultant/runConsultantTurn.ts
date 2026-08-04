import {
  buildArchitectureTurnTrace,
  runDualPathComparison,
  type ArchitectureTurnTrace,
  type DualRunComparison,
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
};

export type RunConsultantTurnResult = {
  state: ConversationCoreState;
  reply: string;
  situation: SituationModel;
  act: ConsultantAct;
  stateUpdate: ConversationStateUpdate;
  /**
   * Diagnostic architecture trace (Phase 4 five-layer preview).
   * Never used for production commits/acts. behaviourSwitchActive is false.
   */
  architectureTrace: ArchitectureTurnTrace;
  /**
   * Dual-run comparison telemetry (legacy vs diagnostic path).
   * Does not override result.state / result.reply.
   */
  dualRunComparison: DualRunComparison;
};

/**
 * Authoritative production turn path — Consultant Turn Governor.
 *
 * Legacy path owns actual state/reply. Phase 4 dual-run telemetry runs in
 * parallel for inspection only (behaviourSwitchActive: false).
 */
export async function runConsultantTurn(
  input: RunConsultantTurnInput,
): Promise<RunConsultantTurnResult> {
  const previousState = input.state;

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

  const act = chooseConsultantAct({
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

  const reply = renderConsultantReply({
    act,
    situation,
    state: stateForReply,
    previousState,
  });

  const result = processConversationTurn({
    message: input.message,
    state: previousState,
    userEntryId: input.userEntryId,
    assistantEntryId: input.assistantEntryId,
    userMessageAt: input.userMessageAt,
    assistantMessageAt: input.assistantMessageAt,
    stateUpdate,
    skipExtraction: true,
    replyOverride: reply,
  });

  // Phase 4 diagnostics — never assigned to production state/reply.
  const architectureTrace = buildArchitectureTurnTrace({
    message: input.message,
    currentState: previousState,
  });

  const dualRunComparison = runDualPathComparison({
    message: input.message,
    priorState: previousState,
    legacyState: result.state,
    legacyReply: result.reply,
    legacyAct: act,
  });

  return {
    state: result.state,
    reply: result.reply,
    situation,
    act,
    stateUpdate,
    architectureTrace,
    dualRunComparison,
  };
}
