/**
 * Sole production entry point: runConversationTurn
 *
 * Mandatory order:
 * 1 context → 2 objective → 3 goals → 4 apply trip changes →
 * 5–6 completeness / nextRequiredField → 7 plan → 8–9 execute/observe →
 * 10 next conversational step → 11 one natural response
 */

import { normalizeInput } from '../normalize';
import type { ConversationState } from '../types';
import { applyValidatedTripChanges } from './apply';
import { calculateTripCompleteness } from './completeness';
import { assembleContext } from './context';
import type { ConversationTurnResult } from './contracts';
import { executeActions } from './execute';
import { detectGoals } from './goals';
import { determineObjective } from './objective';
import { createActionPlan, validateActionPlan } from './plan';
import { generateResponse } from './respond';
import {
  appendTurn,
  getTripType,
  isSearchActive,
  pushConversationTrace,
  resetConversationRuntime,
} from './runtime';
import { decideNextStep } from './step';
import { captureTurnRuntimeEvidence } from '../turnRuntimeEvidence';
import type { TurnRuntimeEvidence } from '../turnRuntimeEvidence';

export function runConversationTurn(input: {
  message: string;
  previousState: ConversationState;
  now?: Date;
  commitTranscript?: boolean;
}): ConversationTurnResult {
  const now = input.now ?? new Date();
  const normalized = normalizeInput(input.message);
  const stateBefore = input.previousState;

  // 1. Assemble complete conversational context
  const ctx = assembleContext({
    userMessage: input.message,
    normalizedMessage: normalized,
    trip: stateBefore,
    now,
  });

  // 2. Determine the user’s current objective
  const objective = determineObjective(ctx);

  // 3. Detect every goal in the current message
  const goals = detectGoals(ctx, objective);

  // 4. Apply validated trip changes to canonical state
  const applied = applyValidatedTripChanges({
    ctx,
    goals,
    state: stateBefore,
  });
  let state = applied.state;
  const applyResults = applied.results;

  const servicesJustAdded = state.services.filter((s) => !stateBefore.services.includes(s));
  const servicesJustRemoved = stateBefore.services.filter((s) => !state.services.includes(s));
  if (servicesJustAdded.length) {
    applyResults.push({
      type: 'add_services',
      detail: servicesJustAdded.join(','),
      ok: true,
    });
  }
  if (servicesJustRemoved.length) {
    applyResults.push({
      type: 'remove_services',
      detail: servicesJustRemoved.join(','),
      ok: true,
    });
  }

  // Also detect services newly present vs before
  const addedServices = servicesJustAdded;

  // 5–6. Known / missing / nextRequiredField from canonical state after changes
  const tripType = getTripType();
  const completeness = calculateTripCompleteness(state, tripType);

  // 7. Create and validate ordered action plan
  const planned = validateActionPlan(
    createActionPlan({ ctx, goals, completeness }),
    completeness,
  );

  // 8–9. Execute authorised actions and observe provider results
  const executed = executeActions({
    state,
    plan: planned,
    completeness,
    now,
    message: normalized,
  });
  state = executed.state;
  const allResults = [...applyResults, ...executed.results];

  // Recompute completeness after provider mutations (e.g. flights defaulted into state)
  const completenessAfter = calculateTripCompleteness(state, getTripType());

  // 10. Decide the next conversational step
  const step = decideNextStep({
    goals,
    completeness: completenessAfter,
    provider: executed.provider,
    executed: allResults,
    servicesJustAdded: addedServices,
  });

  // 11. Generate one natural final response (only after actions)
  const generated = generateResponse({
    ctx,
    state,
    completeness: completenessAfter,
    step,
    provider: executed.provider,
    servicesJustAdded: addedServices,
  });
  const reply = generated.text;

  const runtimeEvidence: TurnRuntimeEvidence = captureTurnRuntimeEvidence({
    conversationSessionId: state.conversationId,
    turnNumber: state.turnCount,
    replySource: generated.replySource,
    nextRequiredField: completenessAfter.nextRequiredField?.id ?? null,
    generatedReply: reply,
  });

  if (input.commitTranscript !== false) {
    appendTurn({ role: 'user', text: input.message, at: now.toISOString() });
    appendTurn({ role: 'aleya', text: reply, at: now.toISOString() });
  }

  const trace = {
    at: now.toISOString(),
    userMessage: input.message,
    objective,
    goals: goals.map((g) => g.kind),
    knownFacts: completenessAfter.known,
    missingRequirements: completenessAfter.missing.map((m) => m.id),
    nextRequiredField: completenessAfter.nextRequiredField?.id ?? null,
    plannedActions: planned.map((a) => a.type),
    executedResults: allResults,
    conversationalStep: step.kind,
    stateBefore: {
      origin: stateBefore.origin?.value,
      destination: stateBefore.destination?.value,
      services: [...stateBefore.services],
    },
    stateAfter: {
      origin: state.origin?.value,
      destination: state.destination?.value,
      services: [...state.services],
    },
    reply,
  };
  pushConversationTrace(trace);

  return {
    state,
    reply,
    objective,
    goals,
    completeness: completenessAfter,
    nextRequiredField: completenessAfter.nextRequiredField,
    plannedActions: planned,
    executedResults: allResults,
    provider: executed.provider,
    conversationalStep: step,
    trace,
    runtimeEvidence,
    activateSearch: executed.provider.activateSearch,
    continueSearch: executed.provider.continueSearch,
    servicesToSearch: executed.provider.servicesToSearch,
    searchSessionActive: isSearchActive(),
    searchPerformed:
      executed.provider.activateSearch || executed.provider.continueSearch,
  };
}

export { resetConversationRuntime, isSearchActive };
