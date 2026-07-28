/** Stage 2 — Determine the user’s current objective. */

import type { ConversationContext, UserObjective } from './contracts';

export function determineObjective(ctx: ConversationContext): UserObjective {
  const text = ctx.normalizedMessage;

  if (
    (/\b(new trip|start over|let'?s go to)\b/i.test(text) ||
      (/\binstead\b/i.test(text) && /\b(forget|go to|gold coast|melbourne)\b/i.test(text)) ||
      (/\bforget\b/i.test(text) && !/\bforget\s+(?:the\s+)?(?:hotel|accommodation|flights?|car)\b/i.test(text)))
  ) {
    return 'change_trip';
  }
  if (ctx.searchSession && /\b(earlier|later|cheaper|keep .{0,40}hotel|refine)\b/i.test(text)) {
    return 'refine_active_search';
  }
  if (
    /\b(begin|start).{0,24}search\b/i.test(text) ||
    (ctx.searchPreviouslyOffered && /\b(yes|yeah|yep|sure|ok|okay|please|go ahead|ready)\b/i.test(text))
  ) {
    return 'authorise_search';
  }
  if (/\bdocklands\b/i.test(text) && /\b(good|worth|recommend|area|\?)\b/i.test(text)) {
    return 'ask_destination_advice';
  }
  return 'collect_trip_requirements';
}
