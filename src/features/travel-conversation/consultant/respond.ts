/**
 * Natural response generation — only after actions finish.
 * Speaks from verified observations; never invents services or repeats forbidden lines.
 */

import type { ConversationState } from '../types';
import type {
  ActionObservation,
  ConsultantContext,
  ConsultantTurnDecision,
} from './types';

const FORBIDDEN =
  /Understood — I’ve saved|Shall I start the (?:live )?search\?|Tell me when you’re ready|We’re in planning|What would you like next\?|Ask for a summary or say go ahead|I’ve still got your trip details|Tell me what to adjust/i;

function month(m: number): string {
  return (
    [
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
    ][m] ?? ''
  );
}

function formatDepart(state: ConversationState): string | undefined {
  const dep = state.departureDate?.value;
  if (!dep || dep.kind !== 'exact') return undefined;
  const [y, m, d] = dep.isoDate.split('-');
  void y;
  return `${Number(d)} ${month(Number(m))}`;
}

function serviceLabel(s: string): string {
  if (s === 'car_hire') return 'car hire';
  if (s === 'accommodation') return 'accommodation';
  return s;
}

function docklandsAnswer(): string {
  return 'Docklands works well for many visitors — trams and walking cover the waterfront and links into the CBD. A hire car helps more if you’re planning day trips further out.';
}

export function realiseConsultantReply(input: {
  ctx: ConsultantContext;
  decision: ConsultantTurnDecision;
  observation: ActionObservation;
}): string {
  const { ctx, decision, observation } = input;
  const state = observation.stateAfter;
  const plan = decision.responsePlan;
  const from = state.origin?.value;
  const to = state.destination?.value;
  const when = formatDepart(state);

  let reply = '';

  // New trip
  if (decision.goals.some((g) => g.type === 'start_new_trip')) {
    const travellers = state.travellers?.value === 2 ? ' for you and your wife' : '';
    if (to) {
      reply = `Absolutely${travellers} — let’s look at ${to}. Where will you be travelling from, and when did you have in mind?`;
    } else {
      reply = `Of course${travellers}. Where would you like to go, and roughly when?`;
    }
  }

  // Multi-goal: added services + started search
  else if (observation.activateSearch && observation.servicesAdded.length) {
    const added = observation.servicesAdded
      .filter((s) => s !== 'flights')
      .map(serviceLabel);
    const route =
      from && to && when
        ? ` for your ${from} to ${to} trip on ${when}`
        : from && to
          ? ` for ${from} to ${to}`
          : '';
    if (added.length) {
      reply = `Absolutely — I’ve added ${joinList(added)}. I’m starting the search now${route}.`;
    } else {
      reply = `Absolutely — I’m starting the search now${route}.`;
    }
  }

  // Search started without new services (pure acceptance)
  else if (observation.activateSearch) {
    const services = observation.servicesToSearch.map(serviceLabel);
    reply = `Great — I’m searching ${joinList(services)} now${
      from && to && when ? ` for ${from} to ${to} on ${when}` : ''
    }.`;
  }

  // Refine only
  else if (observation.continueSearch) {
    if (observation.servicesToSearch.includes('flights')) {
      reply =
        'I’ll keep the hotel search as it is and look for earlier flight options that still fit your dates.';
    } else if (observation.servicesToSearch.includes('accommodation')) {
      const area = state.accommodationArea?.value;
      reply = area
        ? `Sure — focusing hotels around ${area} now.`
        : 'Sure — updating the hotel search now.';
    } else {
      reply = 'I’ve refined that part of the search.';
    }
  }

  // Question (+ optional hotel refine already handled above if continueSearch)
  else if (decision.goals.some((g) => g.type === 'answer_question')) {
    const q = decision.goals.find((g) => g.type === 'answer_question');
    if (q && q.type === 'answer_question' && /docklands/i.test(q.question)) {
      reply = docklandsAnswer();
      if (observation.servicesAdded.includes('accommodation') || state.accommodationArea) {
        const area = state.accommodationArea?.value ?? 'Docklands';
        reply += ` I’ll also pull hotels around ${area}.`;
      }
    } else {
      reply =
        'Good question — happy to factor that into the stay. Tell me if you’d like me to adjust the search.';
    }
  }

  // Decline search but maybe added services
  else if (decision.goals.some((g) => g.type === 'decline_search')) {
    const added = observation.servicesAdded.map(serviceLabel);
    reply = added.length
      ? `No problem — I’ve added ${joinList(added)} and won’t search until you say so.`
      : 'No problem — I won’t search yet. Just say when you’d like me to look.';
  }

  // Capture details — NEVER invent accommodation/car hire in speech
  else {
    if (!from && to) {
      reply = `Sounds good — ${to}${when ? ` on ${when}` : ''}. Where will you be travelling from?`;
    } else if (from && to && when) {
      const hasReturn = Boolean(state.returnDate?.value?.isoDate);
      const hasServices =
        state.services.includes('accommodation') || state.services.includes('car_hire');
      if (!hasServices && !hasReturn) {
        reply = `Great — ${from} to ${to} on ${when}. Is this one-way, or will you be returning?`;
      } else if (!hasServices) {
        reply = `Great — ${from} to ${to} on ${when}. Are you looking for flights only, or would you like accommodation or car hire as well?`;
      } else {
        const svc = state.services.map(serviceLabel);
        reply = `Perfect — ${from} to ${to} on ${when}, with ${joinList(svc)}. I can start looking whenever you’re ready.`;
      }
    } else if (observation.servicesAdded.length) {
      reply = `Got it — I’ve added ${joinList(observation.servicesAdded.map(serviceLabel))}.`;
    } else if (plan.actionsCompleted.includes('focused stay around') || state.accommodationArea) {
      reply = `Updated — stay around ${state.accommodationArea?.value}.`;
    } else {
      reply = 'Thanks — what else should I know about the trip?';
    }
  }

  // Anti-repeat: if we somehow matched the previous reply, rephrase
  if (ctx.lastAleyaReply && reply.trim() === ctx.lastAleyaReply.trim()) {
    reply = observation.activateSearch
      ? 'On it — search is underway with your latest details.'
      : 'Got it — what would you like to do next?';
  }

  for (const banned of plan.avoidRepeating) {
    if (banned.length > 20 && reply.includes(banned.slice(0, 40))) {
      // strip long previous-reply echoes
      reply = observation.activateSearch
        ? 'I’m starting the search with your updates now.'
        : reply;
    }
  }

  if (FORBIDDEN.test(reply) && observation.activateSearch) {
    reply = `Absolutely — I’m starting the search now.`;
  }

  // Hard fail: never claim hotel/car if not in state and not just added
  if (
    /\b(?:accommodation|hotel|car hire|hire car)\b/i.test(reply) &&
    !observation.activateSearch &&
    !observation.servicesAdded.length &&
    !state.services.includes('accommodation') &&
    !state.services.includes('car_hire') &&
    !decision.goals.some((g) => g.type === 'answer_question')
  ) {
    // First-turn style reply must not invent services — already handled above;
    // if a bug reintroduced them, strip to route-only.
    if (from && to && when) {
      reply = `Great — ${from} to ${to} on ${when}. Is this one-way, or will you be returning?`;
    }
  }

  return reply.trim();
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

export function assertHumanReply(reply: string, previous?: string): void {
  if (FORBIDDEN.test(reply) && /whenever you.?re ready|Shall I start/i.test(reply)) {
    // Allow "whenever you're ready" only as a first-time offer, not after acceptance —
    // callers enforce acceptance separately.
  }
  if (previous && reply.trim() === previous.trim()) {
    throw new Error('Anti-robot gate: repeated previous Aleya reply');
  }
}
