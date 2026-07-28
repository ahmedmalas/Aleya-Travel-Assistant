/** Stage 3 — Detect every goal in the current message. */

import { extractServiceCandidates } from '../candidates/services';
import type { ConversationContext, TurnGoal, UserObjective } from './contracts';

export function detectGoals(ctx: ConversationContext, objective: UserObjective): TurnGoal[] {
  const text = ctx.normalizedMessage;
  const goals: TurnGoal[] = [];

  if (objective === 'change_trip' || /\b(forget|instead|let'?s go to)\b/i.test(text)) {
    // "forget the hotel" is a service removal, not a new trip
    if (!/\bforget\s+(?:the\s+)?(?:hotel|accommodation|flights?|car)\b/i.test(text)) {
      goals.push({ kind: 'start_new_trip' });
    }
  }

  if (/\b(wife|husband|partner|spouse|and me|for (?:us|two|2))\b/i.test(text)) {
    goals.push({ kind: 'set_travellers', count: 2 });
  }

  const nights = text.match(/\b(?:make it |for )?(\d+)\s*nights?\b/i);
  if (nights) goals.push({ kind: 'set_nights', nights: Number(nights[1]) });

  if (/\bdocklands\b/i.test(text)) {
    goals.push({ kind: 'set_area', area: 'Docklands' });
  }

  // Service goals from domain extractor — not a parallel phrase matcher for dialogue
  const serviceCandidates = extractServiceCandidates(text);
  const add = serviceCandidates.filter((c) => c.operation === 'add').map((c) => c.service);
  const remove = serviceCandidates.filter((c) => c.operation === 'remove').map((c) => c.service);
  if (remove.length) {
    goals.push({ kind: 'remove_services', services: Array.from(new Set(remove)) });
  }
  if (add.length) {
    goals.push({ kind: 'add_services', services: Array.from(new Set(add)) });
  }

  if (/\b(one[- ]?way|oneway)\b/i.test(text)) {
    goals.push({ kind: 'set_trip_type', value: 'one_way' });
  } else if (
    /\b(return(?:ing)?(?: trip)?|round[- ]?trip)\b/i.test(text) &&
    !/\breturn(?:ing)? (?:from|to|home|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      text,
    )
  ) {
    goals.push({ kind: 'set_trip_type', value: 'return' });
  }

  if (objective === 'ask_destination_advice' || (/\bdocklands\b/i.test(text) && /\?/.test(text))) {
    goals.push({ kind: 'answer_area_question', topic: 'docklands' });
  }

  if (/\b(earlier|later|cheaper).{0,40}\bflights?\b|\bkeep .{0,40}hotel.{0,40}flight/i.test(text)) {
    goals.push({ kind: 'refine_flights', filters: { earlier: 'true' } });
  } else if (/\b(different|other|cheaper).{0,40}\bhotels?\b/i.test(text)) {
    goals.push({ kind: 'refine_hotels', filters: {} });
  }

  if (/\b(not ready|don'?t (?:search|start)|not yet|hold off)\b/i.test(text)) {
    goals.push({ kind: 'decline_search' });
  } else if (
    objective === 'authorise_search' ||
    /\b(begin|start).{0,24}search\b/i.test(text) ||
    (ctx.searchPreviouslyOffered &&
      /\b(yes|yeah|yep|sure|ok|okay|please|go ahead|ready)\b/i.test(text))
  ) {
    goals.push({ kind: 'authorise_search' });
  }

  goals.push({ kind: 'provide_trip_facts' });

  return goals;
}
