/**
 * Agent loop — sole production entry for conversational turns.
 *
 * User message
 *   → Assemble full conversational context
 *   → Understand every user goal
 *   → Create ordered action plan
 *   → Validate each action
 *   → Execute all actions
 *   → Observe results
 *   → Generate one natural human response
 */

import { normalizeInput } from '../normalize';
import type { ConversationState } from '../types';
import { assembleConsultantContext } from './context';
import { executeConsultantDecision } from './execute';
import {
  appendTurn,
  getSearchSession,
  isSearchActive,
  lastAleyaReply,
  pushConsultantTrace,
  resetConsultantRuntime,
} from './memory';
import { reasonConsultantTurn } from './reason';
import { assertHumanReply, realiseConsultantReply } from './respond';
import type { ConsultantTurnResult } from './types';
import { validateDecision } from './validate';

export function runConsultantTurn(input: {
  message: string;
  previousState: ConversationState;
  now?: Date;
  commitTranscript?: boolean;
}): ConsultantTurnResult {
  const now = input.now ?? new Date();
  const normalized = normalizeInput(input.message);

  const ctx = assembleConsultantContext({
    userMessage: input.message,
    normalizedMessage: normalized,
    trip: input.previousState,
  });

  let decision = reasonConsultantTurn(ctx);
  decision = validateDecision(ctx, decision);

  const observation = executeConsultantDecision({ ctx, decision, now });

  // If search was requested but blocked, ask one concise question
  if (
    decision.goals.some((g) => g.type === 'start_search') &&
    !observation.activateSearch
  ) {
    const missing = [];
    if (!observation.stateAfter.origin?.value) missing.push('where you’re travelling from');
    if (!observation.stateAfter.destination?.value) missing.push('destination');
    if (observation.stateAfter.departureDate?.value?.kind !== 'exact') {
      missing.push('travel date');
    }
    decision = {
      ...decision,
      clarification: {
        needed: true,
        reason: 'missing_search_requirements',
        question: missing.length
          ? `I can search as soon as I have ${missing.join(' and ')}.`
          : 'I need one more detail before I can search.',
      },
      responsePlan: {
        ...decision.responsePlan,
        nextUsefulStep: decision.clarification?.question,
        actionsCompleted: decision.responsePlan.actionsCompleted.filter(
          (a) => a !== 'starting the live search',
        ),
      },
    };
  }

  let reply = realiseConsultantReply({ ctx, decision, observation });
  if (decision.clarification?.needed && decision.clarification.question && !observation.activateSearch) {
    // Prefer clarification when search blocked after adds
    if (observation.servicesAdded.length) {
      reply = `I’ve added ${observation.servicesAdded
        .map((s) => (s === 'car_hire' ? 'car hire' : s === 'accommodation' ? 'accommodation' : s))
        .join(' and ')}. ${decision.clarification.question}`;
    } else {
      reply = decision.clarification.question;
    }
  }

  assertHumanReply(reply, lastAleyaReply());

  // Never invent services: flag if reply mentions hotel/car when state has neither
  const inventedServicesOnTurn =
    /\b(?:accommodation|car hire|hire car)\b/i.test(reply) &&
    !observation.stateAfter.services.includes('accommodation') &&
    !observation.stateAfter.services.includes('car_hire') &&
    !observation.servicesAdded.includes('accommodation') &&
    !observation.servicesAdded.includes('car_hire') &&
    !decision.goals.some((g) => g.type === 'answer_question');

  if (inventedServicesOnTurn) {
    const from = observation.stateAfter.origin?.value;
    const to = observation.stateAfter.destination?.value;
    const dep = observation.stateAfter.departureDate?.value;
    let when: string | undefined;
    if (dep && dep.kind === 'exact') {
      const [, m, d] = dep.isoDate.split('-');
      const months = [
        '',
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      when = `${Number(d)} ${months[Number(m)]}`;
    }
    reply =
      from && to && when
        ? `Great — ${from} to ${to} on ${when}. Is this one-way, or will you be returning?`
        : reply;
  }

  if (input.commitTranscript !== false) {
    appendTurn({ role: 'user', text: input.message, at: now.toISOString() });
    appendTurn({ role: 'aleya', text: reply, at: now.toISOString() });
  }

  const tripFields = [
    observation.stateAfter.origin?.value ? 'origin' : null,
    observation.stateAfter.destination?.value ? 'destination' : null,
    observation.stateAfter.departureDate ? 'departureDate' : null,
    observation.stateAfter.returnDate ? 'returnDate' : null,
    observation.stateAfter.accommodationArea ? 'accommodationArea' : null,
    observation.stateAfter.travellers ? 'travellers' : null,
  ].filter(Boolean) as string[];

  const trace = {
    at: now.toISOString(),
    userMessage: input.message,
    understoodMeaning: decision.understoodMeaning,
    goals: decision.goals,
    contextUsed: {
      recentTurnCount: ctx.recentTurns.length,
      tripFields,
      services: [...observation.stateAfter.services],
      lastOffer: ctx.lastOffer?.kind,
      lastQuestion: ctx.lastQuestion,
      searchActive: Boolean(getSearchSession()),
    },
    actionSequence: decision.actionSequence.map((a) => a.type),
    actionsCompleted: decision.responsePlan.actionsCompleted,
    stateBeforeServices: [...observation.stateBefore.services],
    stateAfterServices: [...observation.stateAfter.services],
    providerActions: observation.providerActions,
    replyPreview: reply.slice(0, 200),
    inventedServicesOnTurn: false as const,
    inventedPricesAvailabilityOrBookings: false as const,
    canonicalModifiedByValidatedActionsOnly: true as const,
  };
  pushConsultantTrace(trace);

  return {
    state: observation.stateAfter,
    reply,
    decision,
    observation,
    trace,
    activateSearch: observation.activateSearch,
    continueSearch: observation.continueSearch,
    servicesToSearch: observation.servicesToSearch,
    searchSessionActive: isSearchActive(),
    searchPerformed: observation.activateSearch || observation.continueSearch,
  };
}

export { resetConsultantRuntime, isSearchActive };
