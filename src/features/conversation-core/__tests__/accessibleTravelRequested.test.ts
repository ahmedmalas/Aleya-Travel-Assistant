import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-accessible-travel-requested-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  fields: {
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    adultCount?: number;
    childCount?: number;
    infantCount?: number;
    flightsRequested?: boolean;
    accommodationRequested?: boolean;
    carHireRequested?: boolean;
    activitiesRequested?: boolean;
    restaurantsRequested?: boolean;
    nearbyDiscoveryRequested?: boolean;
    beachesRequested?: boolean;
    campingRequested?: boolean;
    kayakingRequested?: boolean;
    fourWheelDriveRequested?: boolean;
    scenicDrivesRequested?: boolean;
    attractionsRequested?: boolean;
    toursRequested?: boolean;
    eventsRequested?: boolean;
    nightlifeRequested?: boolean;
    shoppingRequested?: boolean;
    wellnessRequested?: boolean;
    familyActivitiesRequested?: boolean;
    accessibleTravelRequested?: boolean;
  } = {},
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-${index}`,
    assistantEntryId: `assistant-${index}`,
    userMessageAt: new Date(CREATED_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(CREATED_AT.getTime() + index * 2000 + 1000),
    ...(fields.origin !== undefined ? { origin: fields.origin } : {}),
    ...(fields.destination !== undefined
      ? { destination: fields.destination }
      : {}),
    ...(fields.departureDate !== undefined
      ? { departureDate: fields.departureDate }
      : {}),
    ...(fields.returnDate !== undefined
      ? { returnDate: fields.returnDate }
      : {}),
    ...(fields.adultCount !== undefined
      ? { adultCount: fields.adultCount }
      : {}),
    ...(fields.childCount !== undefined
      ? { childCount: fields.childCount }
      : {}),
    ...(fields.infantCount !== undefined
      ? { infantCount: fields.infantCount }
      : {}),
    ...(fields.flightsRequested !== undefined
      ? { flightsRequested: fields.flightsRequested }
      : {}),
    ...(fields.accommodationRequested !== undefined
      ? { accommodationRequested: fields.accommodationRequested }
      : {}),
    ...(fields.carHireRequested !== undefined
      ? { carHireRequested: fields.carHireRequested }
      : {}),
    ...(fields.activitiesRequested !== undefined
      ? { activitiesRequested: fields.activitiesRequested }
      : {}),
    ...(fields.restaurantsRequested !== undefined
      ? { restaurantsRequested: fields.restaurantsRequested }
      : {}),
    ...(fields.nearbyDiscoveryRequested !== undefined
      ? { nearbyDiscoveryRequested: fields.nearbyDiscoveryRequested }
      : {}),
    ...(fields.beachesRequested !== undefined
      ? { beachesRequested: fields.beachesRequested }
      : {}),
    ...(fields.campingRequested !== undefined
      ? { campingRequested: fields.campingRequested }
      : {}),
    ...(fields.kayakingRequested !== undefined
      ? { kayakingRequested: fields.kayakingRequested }
      : {}),
    ...(fields.fourWheelDriveRequested !== undefined
      ? { fourWheelDriveRequested: fields.fourWheelDriveRequested }
      : {}),
    ...(fields.scenicDrivesRequested !== undefined
      ? { scenicDrivesRequested: fields.scenicDrivesRequested }
      : {}),
    ...(fields.attractionsRequested !== undefined
      ? { attractionsRequested: fields.attractionsRequested }
      : {}),
    ...(fields.toursRequested !== undefined
      ? { toursRequested: fields.toursRequested }
      : {}),
    ...(fields.eventsRequested !== undefined
      ? { eventsRequested: fields.eventsRequested }
      : {}),
    ...(fields.nightlifeRequested !== undefined
      ? { nightlifeRequested: fields.nightlifeRequested }
      : {}),
    ...(fields.shoppingRequested !== undefined
      ? { shoppingRequested: fields.shoppingRequested }
      : {}),
    ...(fields.wellnessRequested !== undefined
      ? { wellnessRequested: fields.wellnessRequested }
      : {}),
    ...(fields.familyActivitiesRequested !== undefined
      ? { familyActivitiesRequested: fields.familyActivitiesRequested }
      : {}),
    ...(fields.accessibleTravelRequested !== undefined
      ? { accessibleTravelRequested: fields.accessibleTravelRequested }
      : {}),
  });
}

describe('phase 3Z — explicit accessibleTravelRequested only', () => {
  it('initial accessibleTravelRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.accessibleTravelRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want accessible travel', initial, 0, {
      accessibleTravelRequested: true,
    });
    expect(result.state.accessibleTravelRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need wheelchair accessible', initial, 0, {
      accessibleTravelRequested: true,
    });
    expect(withTrue.state.accessibleTravelRequested).toBe(true);

    const withFalse = turn('no step-free', withTrue.state, 1, {
      accessibleTravelRequested: false,
    });
    expect(withFalse.state.accessibleTravelRequested).toBe(false);
    expect(withFalse.state.accessibleTravelRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      accessibleTravelRequested: true,
    });
    expect(first.state.accessibleTravelRequested).toBe(true);

    const second = turn(
      'accessible accommodation disability access',
      first.state,
      1,
    );
    expect(second.state.accessibleTravelRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      accessibleTravelRequested: false,
    });
    expect(first.state.accessibleTravelRequested).toBe(false);

    const second = turn('mobility access', first.state, 1);
    expect(second.state.accessibleTravelRequested).toBe(false);
  });

  it('user message text cannot set accessibleTravelRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'accessible travel',
      'wheelchair accessible',
      'mobility access',
      'step-free',
      'accessible accommodation',
      'disability access',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.accessibleTravelRequested).toBeNull();
      state = result.state;
    });
  });

  it('user message text cannot clear or change an existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      accessibleTravelRequested: true,
    });
    expect(withTrue.state.accessibleTravelRequested).toBe(true);

    const afterWords = turn(
      'accessible travel wheelchair accessible mobility access',
      withTrue.state,
      1,
    );
    expect(afterWords.state.accessibleTravelRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      accessibleTravelRequested: false,
    });
    expect(withFalse.state.accessibleTravelRequested).toBe(false);

    const afterMoreWords = turn(
      'step-free accessible accommodation disability access',
      withFalse.state,
      3,
    );
    expect(afterMoreWords.state.accessibleTravelRequested).toBe(false);
  });

  it('all previous request flags and canonical fields are preserved', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      origin: 'Sydney',
      destination: 'Gold Coast',
      departureDate: '2026-08-15',
      returnDate: '2026-08-22',
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: true,
      beachesRequested: true,
      campingRequested: true,
      kayakingRequested: true,
      fourWheelDriveRequested: true,
      scenicDrivesRequested: true,
      attractionsRequested: true,
      toursRequested: true,
      eventsRequested: true,
      nightlifeRequested: true,
      shoppingRequested: true,
      wellnessRequested: true,
      familyActivitiesRequested: true,
      accessibleTravelRequested: true,
    });
    expect(first.state.accessibleTravelRequested).toBe(true);
    expect(first.state.familyActivitiesRequested).toBe(true);
    expect(first.state.wellnessRequested).toBe(true);
    expect(first.state.shoppingRequested).toBe(true);
    expect(first.state.nightlifeRequested).toBe(true);
    expect(first.state.eventsRequested).toBe(true);
    expect(first.state.toursRequested).toBe(true);
    expect(first.state.attractionsRequested).toBe(true);
    expect(first.state.scenicDrivesRequested).toBe(true);
    expect(first.state.fourWheelDriveRequested).toBe(true);
    expect(first.state.kayakingRequested).toBe(true);
    expect(first.state.campingRequested).toBe(true);
    expect(first.state.beachesRequested).toBe(true);
    expect(first.state.nearbyDiscoveryRequested).toBe(true);
    expect(first.state.restaurantsRequested).toBe(true);
    expect(first.state.activitiesRequested).toBe(true);
    expect(first.state.flightsRequested).toBe(true);
    expect(first.state.accommodationRequested).toBe(true);
    expect(first.state.carHireRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.adultCount).toBe(2);
    expect(first.state.childCount).toBe(1);
    expect(first.state.infantCount).toBe(1);
    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);
    expect(first.state.ageMs).toBe(1000);
    expect(first.state.updatedAt).toBe('2026-07-29T00:00:01.000Z');
    expect(first.state.createdAt).toBe(initial.createdAt);
    expect(first.state.conversationId).toBe(CONVERSATION_ID);

    const second = turn('no accessible travel', first.state, 1, {
      accessibleTravelRequested: false,
    });
    expect(second.state.accessibleTravelRequested).toBe(false);
    expect(second.state.familyActivitiesRequested).toBe(true);
    expect(second.state.wellnessRequested).toBe(true);
    expect(second.state.shoppingRequested).toBe(true);
    expect(second.state.nightlifeRequested).toBe(true);
    expect(second.state.eventsRequested).toBe(true);
    expect(second.state.toursRequested).toBe(true);
    expect(second.state.attractionsRequested).toBe(true);
    expect(second.state.scenicDrivesRequested).toBe(true);
    expect(second.state.fourWheelDriveRequested).toBe(true);
    expect(second.state.kayakingRequested).toBe(true);
    expect(second.state.campingRequested).toBe(true);
    expect(second.state.beachesRequested).toBe(true);
    expect(second.state.nearbyDiscoveryRequested).toBe(true);
    expect(second.state.restaurantsRequested).toBe(true);
    expect(second.state.activitiesRequested).toBe(true);
    expect(second.state.flightsRequested).toBe(true);
    expect(second.state.accommodationRequested).toBe(true);
    expect(second.state.carHireRequested).toBe(true);
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.destination).toBe('Gold Coast');
    expect(second.state.departureDate).toBe('2026-08-15');
    expect(second.state.returnDate).toBe('2026-08-22');
    expect(second.state.adultCount).toBe(2);
    expect(second.state.childCount).toBe(1);
    expect(second.state.infantCount).toBe(1);
    expect(second.state.status).toBe('active');
    expect(second.state.turnCount).toBe(2);
    expect(second.state.ageMs).toBe(3000);
    expect(second.state.updatedAt).toBe('2026-07-29T00:00:03.000Z');
    expect(second.state.createdAt).toBe(initial.createdAt);
  });

  it('existing transcript behaviour remains unchanged', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0, {
      accessibleTravelRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn(
      'accessible travel wheelchair accessible mobility access',
      first.state,
      1,
    );
    expect(second.state.accessibleTravelRequested).toBe(true);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript[0]).toEqual(first.state.transcript[0]);
    expect(second.state.transcript[1]).toEqual(first.state.transcript[1]);
    expect(second.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
