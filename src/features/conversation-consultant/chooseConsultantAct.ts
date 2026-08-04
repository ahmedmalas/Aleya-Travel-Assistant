import { buildTripCaptureSummary } from '../conversation-core/buildTripCaptureSummary';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversation-core/conversationReplyCatalogue';
import type { ConversationCoreState } from '../conversation-core';
import {
  blockingAmbiguity,
  clarificationFromAmbiguity,
} from './buildSituationModel';
import type {
  ConsultantAct,
  ConsultantAskTopic,
  SituationModel,
} from './types';

function journeyReady(state: ConversationCoreState): boolean {
  if (state.origin === null || state.departureDate === null) return false;
  if (state.tripStructure === 'multi_city') {
    return (state.destinationStops?.length ?? 0) >= 2;
  }
  if (state.destination === null) return false;
  if (state.tripStructure === 'one_way') return true;
  return state.returnDate !== null;
}

function passengerReady(state: ConversationCoreState): boolean {
  const needed =
    state.flightsRequested === true || state.accommodationRequested === true;
  if (!needed) return true;
  return (
    state.adultCount !== null &&
    state.childCount !== null &&
    state.infantCount !== null
  );
}

/**
 * Goal-driven readiness gaps — ordered by usefulness for search readiness,
 * not as a rigid form ladder. Skips anything already stored.
 */
export function selectReadinessAskTopic(
  state: ConversationCoreState,
): ConsultantAskTopic | null {
  if (state.openClarification?.blocking) return null;

  if (state.tripStructure === 'multi_city') {
    if ((state.destinationStops?.length ?? 0) < 2) return 'destinationStops';
  } else if (state.destination === null) {
    return 'destination';
  }

  if (state.origin === null) return 'origin';
  if (state.departureDate === null) return 'departureDate';
  if (
    state.tripStructure !== 'one_way' &&
    state.tripStructure !== 'multi_city' &&
    state.returnDate === null
  ) {
    return 'returnDate';
  }

  const passengerRelevant =
    state.flightsRequested === true || state.accommodationRequested === true;
  if (passengerRelevant && state.adultCount === null) return 'adultCount';
  if (passengerRelevant && state.childCount === null) return 'childCount';
  if (passengerRelevant && state.infantCount === null) return 'infantCount';

  if (
    state.flightsRequested === null &&
    state.accommodationRequested === null &&
    state.carHireRequested === null
  ) {
    return 'services';
  }

  if (!journeyReady(state) || !passengerReady(state)) return 'optional';
  return null;
}

function askPrompt(topic: ConsultantAskTopic): string {
  const F = CONVERSATION_REPLY_CATALOGUE.followUps;
  switch (topic) {
    case 'destination':
      return F.destination;
    case 'destinationStops':
      return F.multiCityDestinations;
    case 'origin':
      return F.origin;
    case 'departureDate':
      return F.departureDate;
    case 'returnDate':
      return F.returnDate;
    case 'adultCount':
      return F.flightsAdultCount;
    case 'childCount':
      return F.childCount;
    case 'infantCount':
      return F.infantCount;
    case 'services':
      return 'Would you like me to look at flights, hotels, or car hire for this trip?';
    case 'optional':
      return F.neutralContinuation;
    default:
      return F.neutralContinuation;
  }
}

/**
 * Choose exactly one ConsultantAct from situation + projected canonical state.
 * Priority: clarify → execute → summarise → ask (goal-driven gap).
 */
export function chooseConsultantAct(input: {
  situation: SituationModel;
  /** State after unambiguous facts for this turn have been applied. */
  state: ConversationCoreState;
}): ConsultantAct {
  const { situation, state } = input;

  // Re-ask unanswered open clarification.
  if (state.openClarification?.blocking) {
    const open = state.openClarification;
    return {
      kind: 'clarify',
      reply: open.prompt,
      clarification: open,
      confidence: 0.9,
    };
  }

  const ambiguity = blockingAmbiguity(situation);
  if (ambiguity !== null) {
    const clarification = clarificationFromAmbiguity(ambiguity);
    return {
      kind: 'clarify',
      reply: clarification.prompt,
      clarification,
      confidence: situation.confidence,
    };
  }

  if (state.searchExecutionRequested === true && journeyReady(state)) {
    return {
      kind: 'execute',
      reply: CONVERSATION_REPLY_CATALOGUE.completion.searchExecuting,
      confidence: 0.92,
    };
  }

  if (situation.intent === 'confirm' && journeyReady(state) && passengerReady(state)) {
    return {
      kind: 'execute',
      reply: CONVERSATION_REPLY_CATALOGUE.completion.searchExecuting,
      confidence: 0.9,
    };
  }

  if (state.conversationComplete === true && journeyReady(state)) {
    const summary = buildTripCaptureSummary(state);
    return {
      kind: 'summarise',
      reply: CONVERSATION_REPLY_CATALOGUE.completion.tripReady(summary),
      confidence: 0.88,
    };
  }

  if (situation.intent === 'complete' && journeyReady(state)) {
    const summary = buildTripCaptureSummary(state);
    return {
      kind: 'summarise',
      reply: CONVERSATION_REPLY_CATALOGUE.completion.tripReady(summary),
      confidence: 0.88,
    };
  }

  if (situation.intent === 'amend') {
    const topic = selectReadinessAskTopic(state);
    return {
      kind: 'amend',
      reply: topic
        ? askPrompt(topic)
        : CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation,
      askTopic: topic ?? 'optional',
      confidence: 0.7,
    };
  }

  const topic = selectReadinessAskTopic(state);
  if (topic !== null) {
    return {
      kind: 'ask',
      reply: askPrompt(topic),
      askTopic: topic,
      confidence: 0.8,
    };
  }

  if (journeyReady(state) && passengerReady(state)) {
    const summary = buildTripCaptureSummary(state);
    return {
      kind: 'summarise',
      reply: CONVERSATION_REPLY_CATALOGUE.completion.tripReady(summary),
      confidence: 0.85,
    };
  }

  return {
    kind: 'ask',
    reply: CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation,
    askTopic: 'optional',
    confidence: 0.5,
  };
}
