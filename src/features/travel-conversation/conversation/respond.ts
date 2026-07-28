/**
 * Stage 11 — Generate one natural final response.
 * Runs only after actions execute. Driven by conversational step + verified state.
 * Progression comes from ranked missing requirements, not canned clarify templates.
 */

import {
  formatDiscoveryAckContinue,
  formatDiscoveryQuestionReply,
  formatRecommendationReply,
} from '../destination-discovery';
import type { ConversationState } from '../types';
import { describeProviderLaunchReply } from '../search-projection/providerLaunch';
import type {
  ConversationContext,
  ConversationalStep,
  ProviderObservation,
  TripCompleteness,
} from './contracts';

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
  const [, m, d] = dep.isoDate.split('-');
  return `${Number(d)} ${month(Number(m))}`;
}

function serviceLabel(s: string): string {
  if (s === 'car_hire') return 'car hire';
  if (s === 'accommodation') return 'accommodation';
  return s;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function routeAck(state: ConversationState): string {
  const from = state.origin?.value;
  const to = state.destination?.value;
  const when = formatDepart(state);
  if (from && to && when) return `Great — ${from} to ${to} on ${when}.`;
  if (to && !from) return `Sounds good — ${to}${when ? ` on ${when}` : ''}.`;
  if (from && !to) return `Got it — leaving from ${from}.`;
  if (when) return `Noted — ${when}.`;
  return '';
}

export type GeneratedReply = {
  text: string;
  /** Exact function that produced the visible assistant text. */
  replySource: 'generateResponse';
};

export function generateResponse(input: {
  ctx: ConversationContext;
  state: ConversationState;
  completeness: TripCompleteness;
  step: ConversationalStep;
  provider: ProviderObservation;
  servicesJustAdded?: string[];
}): GeneratedReply {
  const { state, step, ctx } = input;
  const from = state.origin?.value;
  const to = state.destination?.value;
  const when = formatDepart(state);
  const added = (input.servicesJustAdded ?? []).map(serviceLabel);

  let reply = '';

  switch (step.kind) {
    case 'report_search_started': {
      // Reply must describe verified launch outcomes — never planned services alone.
      const launchReply = describeProviderLaunchReply(step.launchResults);
      if (added.length) {
        reply = `Absolutely — I’ve added ${joinList(added)}. ${launchReply}`;
      } else {
        reply = launchReply;
      }
      break;
    }
    case 'report_search_refined': {
      if (step.services.includes('flights')) {
        reply =
          'I’ll keep the hotel search as it is and look for earlier flight options that still fit your dates.';
      } else if (step.services.includes('accommodation')) {
        const area = state.accommodationArea?.value;
        reply = area
          ? `Sure — focusing hotels around ${area} now.`
          : 'Sure — updating the hotel search now.';
      } else {
        reply = 'I’ve refined that part of the search.';
      }
      break;
    }
    case 'answer_then_continue': {
      reply = step.answer;
      if (state.accommodationArea?.value) {
        reply += ` I’ll also pull hotels around ${state.accommodationArea.value}.`;
      }
      if (step.continueWith) {
        reply += ` ${step.continueWith.question}`;
      }
      break;
    }
    case 'acknowledge_and_continue': {
      reply = step.note;
      if (step.continueWith) {
        reply += ` ${step.continueWith.question}`;
      }
      break;
    }
    case 'ask_missing_field': {
      const ack = routeAck(state);
      reply = ack ? `${ack} ${step.field.question}` : step.field.question;
      break;
    }
    case 'ask_discovery_question': {
      reply = state.discovery
        ? formatDiscoveryQuestionReply({
            ...state.discovery,
            pendingQuestionId: step.questionId as NonNullable<
              typeof state.discovery.pendingQuestionId
            >,
          })
        : step.question;
      break;
    }
    case 'recommend_destinations': {
      reply = state.discovery
        ? formatRecommendationReply({
            ...state.discovery,
            recommendations: step.candidates,
          })
        : 'Here are a few destinations that fit. Which feels closest?';
      break;
    }
    case 'offer_search': {
      const services = state.services.map(serviceLabel);
      const svc = services.length ? ` with ${joinList(services)}` : '';
      if (added.length) {
        reply = `Perfect — I’ve added ${joinList(added)}. I can start looking whenever you’re ready.`;
      } else if (from && to && when) {
        reply = `Perfect — ${from} to ${to} on ${when}${svc}. I can start looking whenever you’re ready.`;
      } else {
        reply = 'I can start looking whenever you’re ready.';
      }
      break;
    }
    default:
      reply = input.completeness.nextRequiredField?.question ?? 'Where would you like to travel?';
  }

  // Anti-repeat without falling back to generic clarification / empty-ack loops
  if (ctx.lastAleyaReply && reply.trim() === ctx.lastAleyaReply.trim()) {
    if (state.discovery?.mode === 'active') {
      reply = formatDiscoveryAckContinue(state.discovery);
      if (reply.trim() === ctx.lastAleyaReply.trim()) {
        reply =
          'Still shaping the shortlist — tell me a flight-time limit, budget, or vibe to refine it.';
      }
    } else {
      const next = input.completeness.nextRequiredField;
      reply = next
        ? next.question
        : from && to
          ? `Still working on your ${from} to ${to} trip — what would you like to adjust?`
          : 'Where would you like to travel?';
    }
  }

  return { text: reply.trim(), replySource: 'generateResponse' };
}
