/**
 * Authoritative pipeline:
 * normalise → classify → (extract → assign → merge | control)
 * → post-requirements decision → compose → persist
 *
 * Parser / extraction / merge untouched. Post-requirements owns search approval.
 */

import { assignRoles } from './assign';
import { extractCandidates } from './candidates';
import { classifyMessage, isControlMessageClass } from './classify';
import { evaluateClarification } from './clarify';
import { decideComposeReply } from './compose';
import { pushComposeTrace } from './debugTrace';
import { mergeTravelState } from './merge';
import { normalizeInput } from './normalize';
import {
  decidePostRequirements,
  requirementsReady,
} from './postRequirements';
import {
  getTravelConversation,
  resetTravelConversation,
  setTravelConversation,
} from './store';
import type {
  ClarificationField,
  ConversationState,
  TravelPatch,
  TravelTurnResult,
} from './types';
import { createEmptyConversationState } from './types';

export type SendTravelMessageInput = {
  message: string;
  now?: Date;
  travellerName?: string;
  previousState?: ConversationState;
  commit?: boolean;
};

function fieldResolved(state: ConversationState, field: ClarificationField): boolean {
  if (field === 'origin') return Boolean(state.origin?.value);
  if (field === 'destination') return Boolean(state.destination?.value);
  if (field === 'departureDate') {
    return state.departureDate?.value.kind === 'exact';
  }
  if (field === 'returnDate') {
    return Boolean(state.returnDate?.value.isoDate);
  }
  return false;
}

function bumpMeta(state: ConversationState, now: Date): ConversationState {
  return {
    ...state,
    turnCount: state.turnCount + 1,
    updatedAt: now.toISOString(),
    lastChangedFields: [],
  };
}

function commitIfNeeded(
  input: SendTravelMessageInput,
  state: ConversationState,
): void {
  if (input.commit !== false && input.previousState === undefined) {
    setTravelConversation(state);
  } else if (input.commit && input.previousState !== undefined) {
    setTravelConversation(state);
  }
}

function finishTurn(input: {
  send: SendTravelMessageInput;
  previous: ConversationState;
  state: ConversationState;
  patch: TravelPatch;
  clarification: ReturnType<typeof evaluateClarification>;
  normalized: string;
  now: Date;
  forceMutateCompose?: boolean;
}): TravelTurnResult {
  const { send, previous, state, patch, clarification, normalized, now } = input;

  const postDecision = decidePostRequirements({
    text: send.message,
    previous,
    state,
    clarification,
    baseClass: patch.messageClass ?? 'general_conversation',
  });

  // Mutations that post-requirements detected after a control classify still need extract —
  // handled by caller. Here we only compose.
  const decision = decideComposeReply({
    patch: { ...patch, messageClass: postDecision.messageClass },
    previous,
    state,
    clarification,
    travellerName: send.travellerName,
    postDecision: input.forceMutateCompose
      ? { ...postDecision, action: 'mutate', reply: '' }
      : postDecision,
  });

  const nextState: ConversationState = {
    ...state,
    phase: decision.phase ?? postDecision.phase ?? state.phase,
    lastOffer: decision.lastOffer,
  };

  pushComposeTrace({
    at: now.toISOString(),
    message: send.message,
    normalized,
    messageClass: postDecision.messageClass,
    phaseBefore: previous.phase,
    phaseAfter: nextState.phase,
    pendingClarification: nextState.pendingClarification,
    composeBranch: decision.branch,
    activateSearch: decision.activateSearch,
    replyPreview: decision.reply.slice(0, 120),
  });

  const result: TravelTurnResult = {
    state: nextState,
    reply: decision.reply,
    clarification,
    activateSearch: decision.activateSearch,
    servicesToSearch: decision.servicesToSearch,
    searchPerformed: decision.activateSearch,
  };
  commitIfNeeded(send, nextState);
  return result;
}

export function processTravelTurn(input: SendTravelMessageInput): TravelTurnResult {
  const now = input.now ?? new Date();
  const previous =
    input.previousState !== undefined ? input.previousState : getTravelConversation();

  const normalized = normalizeInput(input.message);
  const classification = classifyMessage(normalized, previous);
  const baseClass = classification.messageClass;

  if (baseClass === 'new_conversation') {
    const empty =
      input.previousState !== undefined
        ? createEmptyConversationState()
        : resetTravelConversation();
    return finishTurn({
      send: input,
      previous,
      state: empty,
      patch: {
        messageClass: 'new_conversation',
        explicitChanges: [],
        clearFields: [],
      },
      clarification: { needed: false },
      normalized,
      now,
    });
  }

  // Peek post-requirements early: only skip extract for true control actions.
  // Place names / fragments must still extract even when requirements look ready.
  const peek = decidePostRequirements({
    text: input.message,
    previous,
    state: previous,
    clarification: evaluateClarification(previous),
    baseClass,
  });

  const skipExtract =
    peek.action === 'start_search' ||
    peek.action === 'summary' ||
    peek.action === 'decline_search' ||
    peek.action === 'lock' ||
    peek.action === 'restart' ||
    peek.action === 'clarify' ||
    (peek.action === 'booking' && peek.activateSearch) ||
    (peek.action === 'itinerary' && peek.activateSearch) ||
    (peek.action === 'answer' &&
      (baseClass === 'greeting' ||
        baseClass === 'thanks' ||
        baseClass === 'rejection'));

  if (skipExtract && isControlMessageClass(baseClass)) {
    const clarification = evaluateClarification(previous);
    const state = {
      ...bumpMeta(previous, now),
      pendingClarification: clarification.needed ? clarification.field : undefined,
      phase: requirementsReady(previous)
        ? previous.phase === 'locked'
          ? ('locked' as const)
          : ('ready' as const)
        : ('requirements' as const),
    };
    return finishTurn({
      send: input,
      previous,
      state,
      patch: {
        messageClass: baseClass,
        explicitChanges: [],
        clearFields: [],
      },
      clarification,
      normalized,
      now,
    });
  }

  const activeClarification = previous.pendingClarification;
  const text = normalized.replace(
    /^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.]?\s+/i,
    '',
  );

  const candidates = extractCandidates(text, now, previous);
  const patch = assignRoles(candidates, previous, classification.answersField);
  patch.messageClass = baseClass;

  let state = mergeTravelState(previous, patch, now, text);

  if (activeClarification && fieldResolved(state, activeClarification)) {
    state = { ...state, pendingClarification: undefined };
  } else {
    state = { ...state, pendingClarification: activeClarification };
  }

  const clarification = evaluateClarification(state);
  const ready = requirementsReady(state);
  state = {
    ...state,
    pendingClarification: clarification.needed ? clarification.field : undefined,
    phase: clarification.needed || !ready
      ? 'requirements'
      : previous.phase === 'locked'
        ? 'locked'
        : 'ready',
  };

  return finishTurn({
    send: input,
    previous,
    state,
    patch,
    clarification,
    normalized,
    now,
    forceMutateCompose: true,
  });
}

export function sendTravelMessage(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): TravelTurnResult {
  getTravelConversation();
  return processTravelTurn({ ...input, commit: true });
}

export { createEmptyConversationState };
