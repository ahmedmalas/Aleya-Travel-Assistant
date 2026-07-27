import { assignRoles } from './assign';
import { extractCandidates } from './candidates';
import { classifyMessage } from './classify';
import { evaluateClarification } from './clarify';
import { composeReply } from './compose';
import { mergeTravelState } from './merge';
import { normalizeInput } from './normalize';
import {
  getTravelConversation,
  resetTravelConversation,
  setTravelConversation,
} from './store';
import type {
  ClarificationField,
  ConversationPhase,
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

function requirementsReady(state: ConversationState): boolean {
  return Boolean(state.destination) && !evaluateClarification(state).needed;
}

function advancePhase(
  previous: ConversationState,
  state: ConversationState,
  messageClass: TravelPatch['messageClass'],
  clarificationNeeded: boolean,
): ConversationPhase {
  if (messageClass === 'new_conversation') return 'requirements';
  if (messageClass === 'summary') return 'review';
  if (messageClass === 'confirmation') {
    if (clarificationNeeded) return previous.phase === 'planning' ? 'planning' : 'requirements';
    return 'planning';
  }
  if (clarificationNeeded) return 'requirements';
  if (previous.phase === 'planning' && requirementsReady(state)) return 'planning';
  if (previous.phase === 'review' && requirementsReady(state)) return 'review';
  if (previous.phase === 'confirmation' && requirementsReady(state)) return 'confirmation';
  return 'requirements';
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

/**
 * Authoritative pipeline:
 * normalise → classify → extract candidates → assign roles → merge once
 * → clear resolved clarification → validate → compose → persist
 */
export function processTravelTurn(input: SendTravelMessageInput): TravelTurnResult {
  const now = input.now ?? new Date();
  const previous =
    input.previousState !== undefined ? input.previousState : getTravelConversation();

  const normalized = normalizeInput(input.message);
  const classification = classifyMessage(normalized, previous);

  if (classification.messageClass === 'new_conversation') {
    const empty = input.previousState !== undefined
      ? createEmptyConversationState()
      : resetTravelConversation();
    const patch: TravelPatch = {
      messageClass: 'new_conversation',
      explicitChanges: [],
      clearFields: [],
    };
    const result: TravelTurnResult = {
      state: empty,
      reply: composeReply({
        patch,
        previous,
        state: empty,
        clarification: { needed: false },
        travellerName: input.travellerName,
      }),
      clarification: { needed: false },
      searchPerformed: false,
    };
    commitIfNeeded(input, empty);
    return result;
  }

  if (
    classification.messageClass === 'greeting' ||
    classification.messageClass === 'thanks'
  ) {
    const patch: TravelPatch = {
      messageClass: classification.messageClass,
      explicitChanges: [],
      clearFields: [],
    };
    return {
      state: previous,
      reply: composeReply({
        patch,
        previous,
        state: previous,
        clarification: { needed: false },
        travellerName: input.travellerName,
      }),
      clarification: { needed: false },
      searchPerformed: false,
    };
  }

  if (
    classification.messageClass === 'summary' ||
    classification.messageClass === 'confirmation'
  ) {
    const clarification = evaluateClarification(previous);
    const phase = advancePhase(
      previous,
      previous,
      classification.messageClass,
      clarification.needed,
    );
    const state = {
      ...bumpMeta(previous, now),
      phase,
      pendingClarification: clarification.needed ? clarification.field : undefined,
    };
    const patch: TravelPatch = {
      messageClass: classification.messageClass,
      explicitChanges: [],
      clearFields: [],
    };
    const reply = composeReply({
      patch,
      previous,
      state,
      clarification,
      travellerName: input.travellerName,
    });
    const result: TravelTurnResult = {
      state,
      reply,
      clarification,
      searchPerformed: false,
    };
    commitIfNeeded(input, state);
    return result;
  }

  const activeClarification = previous.pendingClarification;
  const text = normalized.replace(
    /^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.]?\s+/i,
    '',
  );

  const candidates = extractCandidates(text, now, previous);
  const patch = assignRoles(candidates, previous, classification.answersField);
  patch.messageClass = classification.messageClass;

  let state = mergeTravelState(previous, patch, now, text);

  if (activeClarification && fieldResolved(state, activeClarification)) {
    state = { ...state, pendingClarification: undefined };
  } else {
    state = { ...state, pendingClarification: activeClarification };
  }

  const clarification = evaluateClarification(state);
  state = {
    ...state,
    pendingClarification: clarification.needed ? clarification.field : undefined,
    phase: advancePhase(previous, state, classification.messageClass, clarification.needed),
  };

  const reply = composeReply({
    patch,
    previous,
    state,
    clarification,
    travellerName: input.travellerName,
  });

  const result: TravelTurnResult = {
    state,
    reply,
    clarification,
    searchPerformed: false,
  };

  commitIfNeeded(input, state);
  return result;
}

export function sendTravelMessage(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): TravelTurnResult {
  getTravelConversation();
  return processTravelTurn({ ...input, commit: true });
}

export { createEmptyConversationState };
