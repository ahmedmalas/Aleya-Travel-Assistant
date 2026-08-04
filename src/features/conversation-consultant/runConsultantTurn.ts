import {
  buildArchitectureTurnTrace,
  type ArchitectureTurnTrace,
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
   * Phase 1 diagnostic architecture trace only.
   * Never used for commits, act selection, or UI. behaviourSwitchActive is false.
   */
  architectureTrace: ArchitectureTurnTrace;
};

/**
 * Authoritative production turn path — Consultant Turn Governor.
 *
 * User message + history + canonical state
 *   → semantic SituationModel (via interpretTravelUtterance + clarify-before-write)
 *   → commit only unambiguous facts
 *   → detect blocking ambiguity
 *   → choose one ConsultantAct
 *   → respond from message + situation + act
 *
 * Deterministic validation / canonical apply remain via conversation-core.
 * Fixed slot-filling reply planning is not used on this path.
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

  // Preview state after unambiguous commits (before clarification write).
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

  // Apply commits to a provisional state for act selection.
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

  // Persist clarification when the chosen act is clarify.
  if (act.kind === 'clarify' && act.clarification) {
    stateUpdate = {
      ...stateUpdate,
      openClarification: act.clarification,
    };
  }

  // If act cleared clarification via facts already, keep that.
  if (act.kind !== 'clarify' && provisionalState.openClarification === null) {
    stateUpdate = {
      ...stateUpdate,
      openClarification: null,
    };
  }

  // Conversation-complete / search flags from summarise/execute acts.
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

  // Phase 1: diagnostic trace only — does not influence state, reply, or act.
  const architectureTrace = buildArchitectureTurnTrace({
    message: input.message,
    currentState: previousState,
  });

  return {
    state: result.state,
    reply: result.reply,
    situation,
    act,
    stateUpdate,
    architectureTrace,
  };
}
