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
import type { ClarificationField, ConversationState, TravelPatch, TravelTurnResult } from './types';
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
    const empty = resetTravelConversation();
    const patch: TravelPatch = {
      messageClass: 'new_conversation',
      explicitChanges: [],
      clearFields: [],
    };
    return {
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

  if (input.commit !== false && input.previousState === undefined) {
    setTravelConversation(state);
  } else if (input.commit && input.previousState !== undefined) {
    setTravelConversation(state);
  }

  return result;
}

export function sendTravelMessage(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): TravelTurnResult {
  getTravelConversation();
  return processTravelTurn({ ...input, commit: true });
}

export { createEmptyConversationState };
