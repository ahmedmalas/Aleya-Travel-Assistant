import { evaluateClarification } from './clarify';
import { composeReply } from './compose';
import { extractTravelRequirements } from './extract';
import { mergeTravelState } from './merge';
import {
  getTravelConversation,
  resetTravelConversation,
  setTravelConversation,
} from './store';
import type { ClarificationField, ConversationState, TravelTurnResult } from './types';
import { createEmptyConversationState } from './types';

export type SendTravelMessageInput = {
  message: string;
  now?: Date;
  travellerName?: string;
  /**
   * Tests only — when set, bypasses the live store for previous state.
   * Result is still returned; store is updated only when `commit` is true (default true for live).
   */
  previousState?: ReturnType<typeof createEmptyConversationState>;
  commit?: boolean;
};

function fieldFilled(state: ConversationState, field: ClarificationField): boolean {
  if (field === 'origin') return Boolean(state.origin?.value);
  if (field === 'destination') return Boolean(state.destination?.value);
  if (field === 'departureDate') {
    const dep = state.departureDate?.value;
    return Boolean(dep && dep.kind === 'exact');
  }
  return false;
}

/**
 * Authoritative turn lifecycle:
 * read active clarification
 * → extract (locations assign roles with clarification context)
 * → merge once
 * → clear resolved clarification
 * → validate remaining missing fields
 * → compose reply from the merged state
 * → persist
 */
export function processTravelTurn(input: SendTravelMessageInput): TravelTurnResult {
  const now = input.now ?? new Date();
  const previous =
    input.previousState !== undefined
      ? input.previousState
      : getTravelConversation();

  const activeClarification = previous.pendingClarification;
  const patch = extractTravelRequirements(input.message, previous, now);

  if (patch.isNewConversation) {
    const empty = resetTravelConversation();
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
    return result;
  }

  if (patch.isGreeting || patch.isThanks) {
    const result: TravelTurnResult = {
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
    return result;
  }

  let state = mergeTravelState(previous, patch, now);

  // Clear the clarification that this turn resolved (before asking the next one)
  if (activeClarification && fieldFilled(state, activeClarification)) {
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

/** Live UI entrypoint — always uses and commits canonical store. */
export function sendTravelMessage(
  input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>,
): TravelTurnResult {
  hydrateIfNeeded();
  return processTravelTurn({ ...input, commit: true });
}

function hydrateIfNeeded(): void {
  getTravelConversation();
}
