import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateUpdate,
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
  /**
   * Sole explicit travel-field update boundary. Omitted properties preserve
   * prior state; supplied values (including `false` and `null`) are stored
   * exactly. Never read from message text.
   */
  stateUpdate?: ConversationStateUpdate;
};

export type ProcessConversationTurnResult = {
  state: ConversationCoreState;
  reply: string;
  trace: ProcessConversationTurnTrace;
};

/**
 * Sole public turn-processing entry point for conversation-core.
 *
 * Phase 4A: append raw user + placeholder assistant entries, increment
 * turnCount by one, set updatedAt from assistantMessageAt, set status to
 * active, expose ageMs, and apply explicitly supplied ConversationStateUpdate
 * fields only. Does not interpret, trim, normalise, extract, validate
 * counts, calculate duration, or persist.
 */
export function processConversationTurn(
  input: ProcessConversationTurnInput,
): ProcessConversationTurnResult {
  const base = resolveBaseState(input);
  const nextTurnCount = base.turnCount + 1;
  const assistantTimestamp = input.assistantMessageAt.toISOString();
  const ageMs =
    input.assistantMessageAt.getTime() - new Date(base.createdAt).getTime();
  const update = input.stateUpdate;
  const destination =
    update?.destination !== undefined ? update.destination : base.destination;
  const origin =
    update?.origin !== undefined ? update.origin : base.origin;
  const departureDate =
    update?.departureDate !== undefined
      ? update.departureDate
      : base.departureDate;
  const returnDate =
    update?.returnDate !== undefined ? update.returnDate : base.returnDate;
  const adultCount =
    update?.adultCount !== undefined ? update.adultCount : base.adultCount;
  const childCount =
    update?.childCount !== undefined ? update.childCount : base.childCount;
  const infantCount =
    update?.infantCount !== undefined ? update.infantCount : base.infantCount;
  const flightsRequested =
    update?.flightsRequested !== undefined
      ? update.flightsRequested
      : base.flightsRequested;
  const accommodationRequested =
    update?.accommodationRequested !== undefined
      ? update.accommodationRequested
      : base.accommodationRequested;
  const carHireRequested =
    update?.carHireRequested !== undefined
      ? update.carHireRequested
      : base.carHireRequested;
  const activitiesRequested =
    update?.activitiesRequested !== undefined
      ? update.activitiesRequested
      : base.activitiesRequested;
  const restaurantsRequested =
    update?.restaurantsRequested !== undefined
      ? update.restaurantsRequested
      : base.restaurantsRequested;
  const nearbyDiscoveryRequested =
    update?.nearbyDiscoveryRequested !== undefined
      ? update.nearbyDiscoveryRequested
      : base.nearbyDiscoveryRequested;
  const beachesRequested =
    update?.beachesRequested !== undefined
      ? update.beachesRequested
      : base.beachesRequested;
  const campingRequested =
    update?.campingRequested !== undefined
      ? update.campingRequested
      : base.campingRequested;
  const kayakingRequested =
    update?.kayakingRequested !== undefined
      ? update.kayakingRequested
      : base.kayakingRequested;
  const fourWheelDriveRequested =
    update?.fourWheelDriveRequested !== undefined
      ? update.fourWheelDriveRequested
      : base.fourWheelDriveRequested;
  const scenicDrivesRequested =
    update?.scenicDrivesRequested !== undefined
      ? update.scenicDrivesRequested
      : base.scenicDrivesRequested;
  const attractionsRequested =
    update?.attractionsRequested !== undefined
      ? update.attractionsRequested
      : base.attractionsRequested;
  const toursRequested =
    update?.toursRequested !== undefined
      ? update.toursRequested
      : base.toursRequested;
  const eventsRequested =
    update?.eventsRequested !== undefined
      ? update.eventsRequested
      : base.eventsRequested;
  const nightlifeRequested =
    update?.nightlifeRequested !== undefined
      ? update.nightlifeRequested
      : base.nightlifeRequested;
  const shoppingRequested =
    update?.shoppingRequested !== undefined
      ? update.shoppingRequested
      : base.shoppingRequested;
  const wellnessRequested =
    update?.wellnessRequested !== undefined
      ? update.wellnessRequested
      : base.wellnessRequested;
  const familyActivitiesRequested =
    update?.familyActivitiesRequested !== undefined
      ? update.familyActivitiesRequested
      : base.familyActivitiesRequested;
  const accessibleTravelRequested =
    update?.accessibleTravelRequested !== undefined
      ? update.accessibleTravelRequested
      : base.accessibleTravelRequested;

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
    kayakingRequested,
    fourWheelDriveRequested,
    scenicDrivesRequested,
    attractionsRequested,
    toursRequested,
    eventsRequested,
    nightlifeRequested,
    shoppingRequested,
    wellnessRequested,
    familyActivitiesRequested,
    accessibleTravelRequested,
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
