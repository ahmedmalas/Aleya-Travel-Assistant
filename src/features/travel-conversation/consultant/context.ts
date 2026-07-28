import { evaluateClarification } from '../clarify';
import type { ConversationState } from '../types';
import {
  getSearchSession,
  getTranscript,
  lastAleyaQuestion,
  lastAleyaReply,
} from './memory';
import type { ConsultantContext } from './types';

export function assembleConsultantContext(input: {
  userMessage: string;
  normalizedMessage: string;
  trip: ConversationState;
}): ConsultantContext {
  const clarification = evaluateClarification(input.trip);
  return {
    userMessage: input.userMessage,
    normalizedMessage: input.normalizedMessage,
    recentTurns: getTranscript().slice(-12),
    trip: input.trip,
    lastAleyaReply: lastAleyaReply(),
    lastOffer: input.trip.lastOffer,
    lastQuestion: lastAleyaQuestion(),
    searchSession: getSearchSession(),
    unresolved:
      clarification.needed && clarification.field && clarification.question
        ? { field: clarification.field, question: clarification.question }
        : undefined,
    preferences: [...input.trip.preferences],
  };
}
