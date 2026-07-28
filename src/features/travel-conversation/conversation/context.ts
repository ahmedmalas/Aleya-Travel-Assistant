/** Stage 1 — Assemble complete conversational context. */

import type { ConversationState } from '../types';
import {
  getAwaitingField,
  getSearchSession,
  getTranscript,
  getTripType,
  lastAleyaReply,
  wasSearchOffered,
} from './runtime';
import type { ConversationContext } from './contracts';

export function assembleContext(input: {
  userMessage: string;
  normalizedMessage: string;
  trip: ConversationState;
  now: Date;
}): ConversationContext {
  return {
    userMessage: input.userMessage,
    normalizedMessage: input.normalizedMessage,
    recentTurns: getTranscript().slice(-12),
    trip: input.trip,
    lastAleyaReply: lastAleyaReply(),
    awaitingField: getAwaitingField(),
    searchSession: getSearchSession(),
    searchPreviouslyOffered: wasSearchOffered(),
    tripType: getTripType(),
    now: input.now,
  };
}
