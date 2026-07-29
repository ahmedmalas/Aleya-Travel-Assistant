import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationTranscriptEntry,
} from './types';

/** Temporary boundary reply — no capture of assistant intelligence, inference, or search. */
export const ENGINE_NOT_ASSEMBLED_REPLY =
  'The new Aleya conversation engine has not been assembled yet. Trip planning turns are temporarily unavailable.';

export type ProcessConversationTurnTrace = {
  entryPoint: 'processConversationTurn';
  stateStatus: 'active';
  turnCount: number;
  stateChanged: true;
  messageInterpreted: false;
  persistenceUsed: false;
  userMessageRecorded: true;
  assistantMessageRecorded: true;
};

export type ProcessConversationTurnInput = {
  message: string;
  userEntryId: string;
  assistantEntryId: string;
  userMessageAt: Date;
  assistantMessageAt: Date;
  state?: ConversationCoreState;
  /** Required when `state` is omitted — keeps the factory free of hidden globals. */
  conversationId?: string;
  /** Explicit destination only — stored as injected; never read from message. */
  destination?: string;
  /** Explicit origin only — stored as injected; never read from message. */
  origin?: string;
  /** Explicit departure date only — stored as injected; never read from message. */
  departureDate?: string;
  /** Explicit return date only — stored as injected; never read from message. */
  returnDate?: string;
  /** Explicit adult count only — stored as injected; never read from message. */
  adultCount?: number;
  /** Explicit child count only — stored as injected; never read from message. */
  childCount?: number;
  /** Explicit infant count only — stored as injected; never read from message. */
  infantCount?: number;
  /** Explicit flights request flag only — stored as injected; never read from message. */
  flightsRequested?: boolean;
  /** Explicit accommodation request flag only — stored as injected; never read from message. */
  accommodationRequested?: boolean;
  /** Explicit car-hire request flag only — stored as injected; never read from message. */
  carHireRequested?: boolean;
  /** Explicit activities request flag only — stored as injected; never read from message. */
  activitiesRequested?: boolean;
  /** Explicit restaurants request flag only — stored as injected; never read from message. */
  restaurantsRequested?: boolean;
  /** Explicit nearby-discovery request flag only — stored as injected; never read from message. */
  nearbyDiscoveryRequested?: boolean;
  /** Explicit beaches request flag only — stored as injected; never read from message. */
  beachesRequested?: boolean;
  /** Explicit camping request flag only — stored as injected; never read from message. */
  campingRequested?: boolean;
};

export type ProcessConversationTurnResult = {
  state: ConversationCoreState;
  reply: string;
  trace: ProcessConversationTurnTrace;
};

/**
 * Sole public turn-processing entry point for conversation-core.
 *
 * Phase 3O: append raw user + placeholder assistant entries, increment
 * turnCount by one, set updatedAt from assistantMessageAt, set status to
 * active, expose ageMs, and record explicitly supplied destination/origin/
 * departureDate/returnDate/adultCount/childCount/infantCount/
 * flightsRequested/accommodationRequested/carHireRequested/
 * activitiesRequested/restaurantsRequested/nearbyDiscoveryRequested/
 * beachesRequested/campingRequested only. Does not interpret, trim,
 * normalise, extract, validate counts, calculate duration, or persist.
 */
export function processConversationTurn(
  input: ProcessConversationTurnInput,
): ProcessConversationTurnResult {
  const base = resolveBaseState(input);
  const nextTurnCount = base.turnCount + 1;
  const assistantTimestamp = input.assistantMessageAt.toISOString();
  const ageMs =
    input.assistantMessageAt.getTime() - new Date(base.createdAt).getTime();
  const destination =
    input.destination !== undefined ? input.destination : base.destination;
  const origin = input.origin !== undefined ? input.origin : base.origin;
  const departureDate =
    input.departureDate !== undefined
      ? input.departureDate
      : base.departureDate;
  const returnDate =
    input.returnDate !== undefined ? input.returnDate : base.returnDate;
  const adultCount =
    input.adultCount !== undefined ? input.adultCount : base.adultCount;
  const childCount =
    input.childCount !== undefined ? input.childCount : base.childCount;
  const infantCount =
    input.infantCount !== undefined ? input.infantCount : base.infantCount;
  const flightsRequested =
    input.flightsRequested !== undefined
      ? input.flightsRequested
      : base.flightsRequested;
  const accommodationRequested =
    input.accommodationRequested !== undefined
      ? input.accommodationRequested
      : base.accommodationRequested;
  const carHireRequested =
    input.carHireRequested !== undefined
      ? input.carHireRequested
      : base.carHireRequested;
  const activitiesRequested =
    input.activitiesRequested !== undefined
      ? input.activitiesRequested
      : base.activitiesRequested;
  const restaurantsRequested =
    input.restaurantsRequested !== undefined
      ? input.restaurantsRequested
      : base.restaurantsRequested;
  const nearbyDiscoveryRequested =
    input.nearbyDiscoveryRequested !== undefined
      ? input.nearbyDiscoveryRequested
      : base.nearbyDiscoveryRequested;
  const beachesRequested =
    input.beachesRequested !== undefined
      ? input.beachesRequested
      : base.beachesRequested;
  const campingRequested =
    input.campingRequested !== undefined
      ? input.campingRequested
      : base.campingRequested;

  const userEntry: ConversationTranscriptEntry = {
    id: input.userEntryId,
    role: 'user',
    message: input.message,
    timestamp: input.userMessageAt.toISOString(),
  };

  const assistantEntry: ConversationTranscriptEntry = {
    id: input.assistantEntryId,
    role: 'assistant',
    message: ENGINE_NOT_ASSEMBLED_REPLY,
    timestamp: assistantTimestamp,
  };

  const state: ConversationCoreState = {
    conversationId: base.conversationId,
    status: 'active',
    turnCount: nextTurnCount,
    createdAt: base.createdAt,
    updatedAt: assistantTimestamp,
    ageMs,
    destination,
    origin,
    departureDate,
    returnDate,
    adultCount,
    childCount,
    infantCount,
    flightsRequested,
    accommodationRequested,
    carHireRequested,
    activitiesRequested,
    restaurantsRequested,
    nearbyDiscoveryRequested,
    beachesRequested,
    campingRequested,
    transcript: [...base.transcript, userEntry, assistantEntry],
  };

  return {
    state,
    reply: ENGINE_NOT_ASSEMBLED_REPLY,
    trace: {
      entryPoint: 'processConversationTurn',
      stateStatus: 'active',
      turnCount: nextTurnCount,
      stateChanged: true,
      messageInterpreted: false,
      persistenceUsed: false,
      userMessageRecorded: true,
      assistantMessageRecorded: true,
    },
  };
}

function resolveBaseState(input: ProcessConversationTurnInput): ConversationCoreState {
  if (input.state) return input.state;

  if (!input.conversationId) {
    throw new Error(
      'processConversationTurn requires state, or conversationId when creating initial state',
    );
  }

  return createInitialConversationCoreState({
    conversationId: input.conversationId,
    now: input.userMessageAt,
  });
}
