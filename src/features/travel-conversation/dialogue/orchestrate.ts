/**
 * Conversational orchestration — sole production dialogue path.
 *
 * User message
 *   → context assembly
 *   → goal understanding
 *   → DialogueDecision
 *   → execute validated actions
 *   → natural response realisation
 */

import { evaluateClarification } from '../clarify';
import { normalizeInput } from '../normalize';
import type { ConversationState } from '../types';
import { assembleContext } from './context';
import { decideDialogue } from './decide';
import { executeDecision } from './execute';
import { analyzeGoals } from './goals';
import { assertHumanReply, realiseResponse } from './nlg';
import { resetDialogueRuntime } from './runtime';
import { getSearchMemory } from './searchMemory';
import { appendTurn, getTranscript } from './transcript';
import { pushDialogueTrace } from './traces';
import type { DialogueTurnResult } from './types';

export function runDialogueTurn(input: {
  message: string;
  previousState: ConversationState;
  now?: Date;
  commitTranscript?: boolean;
}): DialogueTurnResult {
  const now = input.now ?? new Date();
  const normalized = normalizeInput(input.message);

  // Context against state *before* this turn’s mutations
  const ctx = assembleContext({
    userMessage: input.message,
    normalizedMessage: normalized,
    trip: input.previousState,
  });

  const analysis = analyzeGoals(ctx);
  let decision = decideDialogue(ctx, analysis);

  const execution = executeDecision({ ctx, decision, now });

  // Post-merge clarification: if still blocked, ask one human question
  const missing = evaluateClarification(execution.state);
  if (
    missing.needed &&
    missing.question &&
    !execution.activateSearch &&
    decision.responsePlan.purpose === 'capture_details'
  ) {
    decision = {
      ...decision,
      clarification: {
        reason: 'missing_requirement',
        question: missing.question,
        field: missing.field,
      },
      responsePlan: {
        ...decision.responsePlan,
        nextStep: missing.question,
      },
    };
  }

  // After merge: if requirements are ready and no search yet, offer to look
  // (decision may have run against pre-merge state and missed readiness).
  if (
    !missing.needed &&
    !execution.searchSession &&
    !execution.activateSearch &&
    !execution.continueSearch &&
    decision.responsePlan.purpose !== 'answer_travel_question' &&
    decision.responsePlan.purpose !== 'welcome_new_trip' &&
    !decision.userGoals.includes('decline_search')
  ) {
    execution.state = {
      ...execution.state,
      lastOffer: { kind: 'start_search', atTurn: execution.state.turnCount },
      phase: 'ready',
    };
    if (
      decision.responsePlan.purpose === 'continue_naturally' ||
      decision.responsePlan.purpose === 'capture_details'
    ) {
      decision = {
        ...decision,
        responsePlan: {
          ...decision.responsePlan,
          purpose: 'capture_details',
          nextStep:
            decision.responsePlan.nextStep ??
            'I can start looking whenever you’re ready.',
        },
      };
    }
  }

  const reply = realiseResponse({ ctx, decision, execution });
  assertHumanReply(reply);

  if (input.commitTranscript !== false) {
    appendTurn({ role: 'user', text: input.message, at: now.toISOString() });
    appendTurn({ role: 'aleya', text: reply, at: now.toISOString() });
  }

  const tripFields = [
    execution.state.origin?.value ? 'origin' : null,
    execution.state.destination?.value ? 'destination' : null,
    execution.state.departureDate ? 'departureDate' : null,
    execution.state.returnDate ? 'returnDate' : null,
    execution.state.accommodationArea ? 'accommodationArea' : null,
    execution.state.travellers ? 'travellers' : null,
  ].filter(Boolean) as string[];

  const trace = {
    at: now.toISOString(),
    userMessage: input.message,
    userGoals: decision.userGoals,
    contextUsed: {
      recentTurnCount: ctx.recentTurns.length,
      tripFields,
      searchActive: Boolean(getSearchMemory()),
      lastOffer: ctx.lastOffer?.kind,
      lastQuestion: ctx.lastQuestion,
      currentAim: ctx.currentAim,
    },
    actionsExecuted: {
      state: decision.stateActions.map((a) => a.type),
      search: decision.searchActions.map((a) => a.type),
    },
    responsePlan: decision.responsePlan,
    replyPreview: reply.slice(0, 160),
    canonicalModifiedByValidatedActionsOnly: true as const,
    inventedPricesAvailabilityOrBookings: false as const,
  };
  pushDialogueTrace(trace);

  return {
    state: execution.state,
    reply,
    decision,
    trace,
    activateSearch: execution.activateSearch,
    continueSearch: execution.continueSearch,
    servicesToSearch: execution.servicesToSearch,
    searchSessionActive: Boolean(getSearchMemory()),
    searchPerformed: execution.activateSearch || execution.continueSearch,
  };
}

export { resetDialogueRuntime, getTranscript };
