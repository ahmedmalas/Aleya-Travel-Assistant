import { evaluateClarification } from './clarify';
import { composeReply } from './compose';
import { extractTravelRequirements } from './extract';
import { mergeTravelState } from './merge';
import {
  getTravelConversation,
  resetTravelConversation,
  setTravelConversation,
} from './store';
import type { TravelTurnResult } from './types';
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

/**
 * Authoritative turn lifecycle:
 * extract → merge once → clarify → compose → persist/project same state
 */
export function processTravelTurn(input: SendTravelMessageInput): TravelTurnResult {
  const now = input.now ?? new Date();
  const previous =
    input.previousState !== undefined
      ? input.previousState
      : getTravelConversation();

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

  const state = mergeTravelState(previous, patch, now);
  const clarification = evaluateClarification(state);
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
    // Test helper path that still wants store updated
    setTravelConversation(state);
  }

  return result;
}

/** Live UI entrypoint — always uses and commits canonical store. */
export function sendTravelMessage(input: Omit<SendTravelMessageInput, 'previousState' | 'commit'>): TravelTurnResult {
  hydrateIfNeeded();
  return processTravelTurn({ ...input, commit: true });
}

function hydrateIfNeeded(): void {
  getTravelConversation();
}
