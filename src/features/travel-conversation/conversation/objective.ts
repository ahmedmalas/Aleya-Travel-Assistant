/** Stage 2 — Determine the user’s current objective. */

import {
  hasExplicitNamedDestination,
  looksLikeDiscoveryIntent,
  matchSelectionFromMessage,
} from '../destination-discovery';
import type { ConversationContext, UserObjective } from './contracts';

export function determineObjective(ctx: ConversationContext): UserObjective {
  const text = ctx.normalizedMessage;
  const discovery = ctx.trip.discovery;

  // Selection inside an active discovery session stays on discovery until resolve/transition
  if (discovery?.mode === 'active' && matchSelectionFromMessage(text, discovery)) {
    return 'discover_destination';
  }

  if (looksLikeDiscoveryIntent(text, ctx.trip)) {
    // Named booking wins only when the utterance is clearly a place booking, not soft discovery
    if (
      hasExplicitNamedDestination(text) &&
      discovery?.mode !== 'active' &&
      !/\bsomewhere\b|\bfind\s+me\b|\bwhere\s+should\b|\brecommend\b/i.test(text)
    ) {
      return 'collect_trip_requirements';
    }
    return 'discover_destination';
  }

  // Destination field replacement is NOT a full trip reset
  if (
    /\b(?:change|switch|update|set)\s+(?:(?:it|the)\s+)*(?:destination\s+)?(?:to|for)\b/i.test(text) ||
    /\bactually\s+\w+/i.test(text) ||
    /\bnot\s+\w+.+\b(?:anymore|any more)\b/i.test(text)
  ) {
    return 'collect_trip_requirements';
  }

  if (
    /\b(new trip|start over)\b/i.test(text) ||
    (/\binstead\b/i.test(text) && /\b(forget|go to|gold coast|melbourne)\b/i.test(text)) ||
    (/\bforget\b/i.test(text) &&
      !/\bforget\s+(?:the\s+)?(?:hotel|accommodation|flights?|car)\b/i.test(text))
  ) {
    // "let's go to X" during discovery is selection, not trip reset — handled above
    if (discovery?.mode === 'active' && /\blet'?s\s+go\s+to\b/i.test(text)) {
      return 'discover_destination';
    }
    if (/\blet'?s\s+go\s+to\b/i.test(text) && !hasExplicitNamedDestination(text)) {
      return 'discover_destination';
    }
    return 'change_trip';
  }

  if (/\blet'?s\s+go\s+to\b/i.test(text) && hasExplicitNamedDestination(text)) {
    if (discovery?.mode === 'active') return 'discover_destination';
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
