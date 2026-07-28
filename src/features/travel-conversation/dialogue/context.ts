import { evaluateClarification } from '../clarify';
import type { ConversationState } from '../types';
import { getSearchMemory } from './searchMemory';
import { getTranscript, lastAleyaQuestion } from './transcript';
import type { ConversationContext } from './types';

function inferCurrentAim(
  message: string,
  trip: ConversationState,
  searchActive: boolean,
  lastOffer?: ConversationState['lastOffer'],
  lastQuestion?: string,
): string {
  const m = message.toLowerCase();
  if (searchActive && /\b(?:hotel|accommodation|docklands|luxury|cheaper|flights?|car)\b/i.test(m)) {
    return 'refine or discuss active search results';
  }
  if (lastOffer?.kind === 'start_search' && /^(?:yes|yeah|yep|please|go ahead|ok|okay|sure)\b/i.test(m)) {
    return 'approve starting live search';
  }
  if (lastQuestion && /^(?:sydney|melbourne|brisbane|perth|adelaide|[\w\s]{2,30})$/i.test(message.trim())) {
    return 'answer Aleya’s open question';
  }
  if (/\b(?:new trip|start over|clear trip|gold coast for my wife)\b/i.test(m)) {
    return 'begin a new trip';
  }
  if (!trip.destination && /\b(?:want to go|need|looking|trip|fly|hotel)\b/i.test(m)) {
    return 'share initial trip details';
  }
  if (/\b(?:book|second one|that one)\b/i.test(m)) {
    return 'refer to a specific option';
  }
  if (/\?$|\b(?:is |are |should |can |good place|convenient)\b/i.test(m)) {
    return 'ask a travel question';
  }
  return 'continue the trip conversation';
}

export function assembleContext(input: {
  userMessage: string;
  normalizedMessage: string;
  trip: ConversationState;
}): ConversationContext {
  const clarification = evaluateClarification(input.trip);
  const searchSession = getSearchMemory();
  const recentTurns = getTranscript().slice(-12);
  const lastQuestion = lastAleyaQuestion();

  return {
    userMessage: input.userMessage,
    normalizedMessage: input.normalizedMessage,
    recentTurns,
    trip: input.trip,
    unresolved:
      clarification.needed && clarification.field && clarification.question
        ? { field: clarification.field, question: clarification.question }
        : undefined,
    searchSession,
    lastOffer: input.trip.lastOffer,
    lastQuestion,
    preferences: [...input.trip.preferences],
    recentChanges: [...input.trip.lastChangedFields],
    currentAim: inferCurrentAim(
      input.normalizedMessage,
      input.trip,
      Boolean(searchSession),
      input.trip.lastOffer,
      lastQuestion,
    ),
  };
}
