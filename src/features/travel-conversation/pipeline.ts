/**
 * Authoritative pipeline (intent-router rebuild):
 * normalise → classify intent → (extract → assign → merge | control path)
 * → readiness phase → compose → persist
 *
 * Phase is readiness only. Intent is always classified; compose answers the intent.
 */

import { assignRoles } from './assign';
import { extractCandidates } from './candidates';
import { classifyMessage } from './classify';
import { evaluateClarification } from './clarify';
import { decideComposeReply } from './compose';
import { pushComposeTrace } from './debugTrace';
import {
  isControlIntent,
  resolveReadinessPhase,
} from './intentRouter';
import { mergeTravelState } from './merge';
import { normalizeInput } from './normalize';
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

function requirementsComplete(state: ConversationState): boolean {
  return Boolean(state.destination) && !evaluateClarification(state).needed;
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
}): TravelTurnResult {
  const { send, previous, state, patch, clarification, normalized, now } = input;
  const decision = decideComposeReply({
    patch,
    previous,
    state,
    clarification,
    travellerName: send.travellerName,
  });
  pushComposeTrace({
    at: now.toISOString(),
    message: send.message,
    normalized,
    messageClass: patch.messageClass,
    phaseBefore: previous.phase,
    phaseAfter: state.phase,
    pendingClarification: state.pendingClarification,
    composeBranch: decision.branch,
    replyPreview: decision.reply.slice(0, 120),
  });
  const result: TravelTurnResult = {
    state,
    reply: decision.reply,
    clarification,
    searchPerformed: false,
  };
  commitIfNeeded(send, state);
  return result;
}

export function processTravelTurn(input: SendTravelMessageInput): TravelTurnResult {
  const now = input.now ?? new Date();
  const previous =
    input.previousState !== undefined ? input.previousState : getTravelConversation();

  const normalized = normalizeInput(input.message);
  const classification = classifyMessage(normalized, previous);
  const intent = classification.messageClass;

  if (intent === 'new_conversation') {
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

  if (intent === 'greeting' || intent === 'thanks') {
    return finishTurn({
      send: input,
      previous,
      state: previous,
      patch: {
        messageClass: intent,
        explicitChanges: [],
        clearFields: [],
      },
      clarification: { needed: false },
      normalized,
      now,
    });
  }

  // Control intents: answer the request without extract/merge.
  if (isControlIntent(intent)) {
    const clarification = evaluateClarification(previous);
    const phase = resolveReadinessPhase({
      previous,
      intent,
      requirementsComplete: requirementsComplete(previous),
      clarificationNeeded: clarification.needed,
      mutated: false,
    });
    const state = {
      ...bumpMeta(previous, now),
      phase,
      pendingClarification: clarification.needed ? clarification.field : undefined,
    };
    return finishTurn({
      send: input,
      previous,
      state,
      patch: {
        messageClass: intent,
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
  patch.messageClass = intent;

  let state = mergeTravelState(previous, patch, now, text);

  if (activeClarification && fieldResolved(state, activeClarification)) {
    state = { ...state, pendingClarification: undefined };
  } else {
    state = { ...state, pendingClarification: activeClarification };
  }

  const clarification = evaluateClarification(state);
  const mutated = state.lastChangedFields.length > 0;
  state = {
    ...state,
    pendingClarification: clarification.needed ? clarification.field : undefined,
    phase: resolveReadinessPhase({
      previous,
      intent,
      requirementsComplete: requirementsComplete(state),
      clarificationNeeded: clarification.needed,
      mutated,
    }),
  };

  return finishTurn({
    send: input,
    previous,
    state,
    patch,
    clarification,
    normalized,
    now,
  });
}

export function sendTravelMessage(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): TravelTurnResult {
  getTravelConversation();
  return processTravelTurn({ ...input, commit: true });
}

export { createEmptyConversationState };
