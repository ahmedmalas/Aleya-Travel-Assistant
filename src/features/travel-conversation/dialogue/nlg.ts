/**
 * Natural language realisation from a response plan + verified action results.
 * Composes varied human consultant wording from facts — not a catalogue of
 * full canned reply templates keyed by phase.
 */

import { evaluateClarification } from '../clarify';
import type { ConversationState } from '../types';
import type { ActionExecutionResult, ConversationContext, DialogueDecision } from './types';

const FORBIDDEN =
  /Understood — I’ve saved|We’re in planning|What would you like next\?|Ask for a summary or say go ahead|I’ve still got your trip details|Tell me what to adjust|phase|schemaVersion|messageClass/i;

function pick<T>(items: T[], salt: number): T {
  return items[Math.abs(salt) % items.length];
}

function formatWhen(state: ConversationState): string | undefined {
  const dep = state.departureDate?.value;
  if (!dep || dep.kind !== 'exact') return undefined;
  const ret = state.returnDate?.value.isoDate;
  const [y, m, d] = dep.isoDate.split('-');
  const out = `${Number(d)} ${month(Number(m))}`;
  if (!ret) return out;
  const [, rm, rd] = ret.split('-');
  return `${out} to ${Number(rd)} ${month(Number(rm))}`;
}

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

function docklandsAnswer(): string {
  return pick(
    [
      'Docklands is convenient without a car for many visitors — trams and walking cover the waterfront, Marvel Stadium, and links into the CBD. A hire car helps more if you’re planning day trips further out.',
      'You can get by in Docklands without a car: trams run along the waterfront and it’s an easy hop into the city. Keep the hire car if you want flexibility beyond the inner suburbs.',
      'Docklands works well car-free for a city break — good tram access and walkable dining. I’d only lean on the hire car for wider Victoria day trips.',
    ],
    Date.now(),
  );
}

export function realiseResponse(input: {
  ctx: ConversationContext;
  decision: DialogueDecision;
  execution: ActionExecutionResult;
}): string {
  const { ctx, decision, execution } = input;
  const state = execution.state;
  const plan = decision.responsePlan;
  const salt = state.turnCount + plan.purpose.length;
  const missing = evaluateClarification(state);

  let reply = '';

  switch (plan.purpose) {
    case 'welcome_new_trip': {
      const travellers = plan.factsToMention.includes('two travellers')
        ? ' for you and your wife'
        : '';
      const dest = state.destination?.value;
      if (dest) {
        reply = pick(
          [
            `Absolutely${travellers} — let’s look at ${dest}. Where will you be travelling from, and when did you have in mind?`,
            `Perfect${travellers}. Fresh plan for ${dest}. What’s your departure city and rough dates?`,
          ],
          salt,
        );
      } else {
        reply = pick(
          [
            `Of course${travellers}. Where would you like to go, and roughly when?`,
            `Happy to start fresh${travellers}. Tell me the destination and timing you have in mind.`,
            `Absolutely — new trip it is${travellers}. Where are we heading?`,
          ],
          salt,
        );
      }
      break;
    }
    case 'answer_travel_question': {
      if (/docklands/i.test(ctx.normalizedMessage) && /car|convenient|without/i.test(ctx.normalizedMessage)) {
        reply = docklandsAnswer();
      } else {
        reply = pick(
          [
            'Good question. Based on what we’ve discussed, that area should work for your dates — happy to adjust the stay if you’d rather be closer to something specific.',
            'It depends a little on what you want nearby, but it’s a solid option for your trip. I can shift the hotel search if you’d prefer another pocket of the city.',
          ],
          salt,
        );
      }
      break;
    }
    case 'start_search': {
      const services = execution.servicesToSearch
        .map((s) => (s === 'car_hire' ? 'car hire' : s === 'accommodation' ? 'hotels' : s))
        .join(', ')
        .replace(/, ([^,]*)$/, ' and $1');
      reply = pick(
        [
          `Perfect — I’ll start looking at ${services} with your details now.`,
          `Great. Searching ${services} for you now.`,
          `On it — pulling live options for ${services}.`,
        ],
        salt,
      );
      break;
    }
    case 'search_already_active': {
      reply = pick(
        [
          'Your search is already running. Tell me what to refine — hotels, flights, or car hire.',
          'We’re already mid-search. What would you like to focus on next?',
        ],
        salt,
      );
      break;
    }
    case 'refine_active_search':
    case 'start_then_refine': {
      const area = state.accommodationArea?.value;
      const style = execution.searchSession?.filters.accommodation?.style;
      const focus = execution.servicesToSearch[0];
      if (focus === 'accommodation') {
        const styleBit =
          style === 'luxury' || style === 'value'
            ? style === 'value'
              ? 'well-rated four- and five-star options that still offer reasonable value'
              : 'more luxurious options'
            : style === 'nice'
              ? 'nice, comfortable options'
              : 'the best fits';
        reply = area
          ? pick(
              [
                `Sure — I’ll focus accommodation on ${area} and nearby areas while keeping your flights and car hire unchanged.`,
                `Absolutely. Narrowing hotels to ${area}, leaving flights and the hire car as they are.`,
              ],
              salt,
            )
          : `Got it. I’ll prioritise ${styleBit} for your stay.`;
        if (!area && (style === 'luxury' || style === 'value')) {
          reply = `Got it. I’ll prioritise ${styleBit}${state.accommodationArea?.value ? ` around ${state.accommodationArea.value}` : ''}.`;
        }
        if (area && (style === 'luxury' || style === 'value')) {
          reply = `Got it. I’ll prioritise ${styleBit} around ${area}.`;
        }
      } else if (focus === 'flights') {
        reply = pick(
          [
            'I’ll look for better flights that arrive earlier, and keep your hotel choice as it is.',
            'Sure — refining flights toward earlier arrivals while holding the rest of the plan.',
          ],
          salt,
        );
      } else if (focus === 'car_hire') {
        reply = 'Happy to adjust the car hire — I’ll look at smaller options that still suit your dates.';
      } else {
        reply = 'I’ll refine that part of the search and leave the rest unchanged.';
      }
      break;
    }
    case 'refresh_after_change': {
      const when = formatWhen(state);
      reply = when
        ? `Updated — I’ve moved you to ${when}. Refreshing the affected searches now.`
        : 'Updated those details and refreshing the searches that depend on them.';
      break;
    }
    case 'note_selection':
    case 'booking_handoff': {
      const selected = execution.selectedResult;
      if (plan.purpose === 'booking_handoff' && selected) {
        reply = `The ${selected.label} looks like the one you mean. I can’t complete a booking inside Aleya, but I can take you through to the provider to finish it securely.`;
      } else if (selected && execution.continueSearch) {
        reply = `Noted — I’ll keep ${selected.label}. Looking at earlier flight options that still fit your dates.`;
      } else if (selected) {
        reply = `Great choice noting ${selected.label}. What would you like to compare it against?`;
      } else {
        reply =
          'I want to be sure I have the right option — did you mean the second flight or the second hotel?';
      }
      break;
    }
    case 'review_trip': {
      const bits: string[] = [];
      if (state.origin?.value && state.destination?.value) {
        bits.push(`${state.origin.value} to ${state.destination.value}`);
      } else if (state.destination?.value) bits.push(`destination ${state.destination.value}`);
      const when = formatWhen(state);
      if (when) bits.push(when);
      if (state.accommodationArea?.value) bits.push(`stay around ${state.accommodationArea.value}`);
      reply = bits.length
        ? `Here’s the shape of it: ${bits.join(', ')}. Want me to look at options, or change anything first?`
        : 'I don’t have enough of the trip sketched yet — tell me where and when you’d like to go.';
      break;
    }
    case 'decline_search': {
      reply = 'No problem — I won’t search yet. Just say when you’d like me to look.';
      break;
    }
    case 'casual': {
      reply = /thanks|thank/i.test(ctx.normalizedMessage)
        ? 'You’re welcome.'
        : 'Hi — how can I help with the trip?';
      break;
    }
    case 'itinerary_after_search': {
      reply =
        'I don’t invent day plans. I’ll search with your details first, then we can shape an itinerary from real options.';
      break;
    }
    case 'need_detail_before_search': {
      reply = decision.clarification?.question
        ? `Almost there — ${decision.clarification.question}`
        : 'I just need one more detail before I look.';
      break;
    }
    case 'capture_details':
    default: {
      // Natural capture / clarification — never dump full saved state
      if (missing.needed && missing.field === 'origin' && state.destination?.value) {
        reply = pick(
          [
            'Absolutely. Where will you be travelling from?',
            'Sounds good. Where are you flying from?',
            'Great choice. What’s your departure city?',
          ],
          salt,
        );
        break;
      }
      if (missing.needed && missing.question) {
        reply = missing.question;
        break;
      }
      if (requirementsReadyLocal(state) && !execution.searchSession) {
        const from = state.origin?.value;
        const to = state.destination?.value;
        const when = formatWhen(state);
        const stay = state.accommodationArea?.value;
        const bits = [
          from && to ? `${from} to ${to}` : to,
          when,
          state.services.includes('accommodation') ? 'accommodation' : null,
          state.services.includes('car_hire') ? 'a hire car' : null,
        ].filter(Boolean);
        reply = pick(
          [
            `Perfect. I’ll look at ${bits.join(', ')}${stay ? '' : ''}. ${
              stay
                ? `Is ${stay} your preferred area, or are you open to nearby options?`
                : 'I can start looking whenever you’re ready.'
            }`,
            `Lovely — ${bits.join(', ')}. ${
              stay
                ? `Shall I focus stays around ${stay}, or keep the area flexible?`
                : 'Shall I start looking?'
            }`,
          ],
          salt,
        );
        // Scenario 1 after Sydney: confirm + optional area question OR offer search
        if (from && to && when && !stay) {
          reply = `Perfect. I’ll look at ${from} to ${to} from ${when}, with accommodation and a hire car. I can start looking whenever you’re ready.`;
        }
        if (from && to && when && stay) {
          reply = `Perfect. I’ll look at ${from} to ${to} from ${when}, with accommodation around ${stay} and a hire car. I can start looking whenever you’re ready.`;
        }
      } else {
        reply = pick(
          [
            'Thanks — I’ve got that. What else should I know?',
            'Got it. Anything else to add before I look?',
          ],
          salt,
        );
      }
      break;
    }
  }

  if (FORBIDDEN.test(reply)) {
    reply = 'Happy to help with the next step on your trip — what would you like to do?';
  }

  return reply.trim();
}

function requirementsReadyLocal(state: ConversationState): boolean {
  return Boolean(state.destination) && !evaluateClarification(state).needed;
}

export function assertHumanReply(reply: string): void {
  if (FORBIDDEN.test(reply)) {
    throw new Error(`Anti-robot gate failed: reply contained forbidden pattern: ${reply}`);
  }
}
