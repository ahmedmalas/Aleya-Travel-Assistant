import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-attractions-requested-001';
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
  } = {},
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-${index}`,
    assistantEntryId: `assistant-${index}`,
    userMessageAt: new Date(CREATED_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(CREATED_AT.getTime() + index * 2000 + 1000),
    ...(Object.keys(fields).length > 0
      ? { stateUpdate: fields }
      : {}),
  });
}

describe('phase 3S — explicit attractionsRequested only', () => {
  it('initial attractionsRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.attractionsRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want attractions', initial, 0, {
      attractionsRequested: true,
    });
    expect(result.state.attractionsRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need tourist attractions', initial, 0, {
      attractionsRequested: true,
    });
    expect(withTrue.state.attractionsRequested).toBe(true);

    const withFalse = turn('no landmarks', withTrue.state, 1, {
      attractionsRequested: false,
    });
    expect(withFalse.state.attractionsRequested).toBe(false);
    expect(withFalse.state.attractionsRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      attractionsRequested: true,
    });
    expect(first.state.attractionsRequested).toBe(true);

    const second = turn('places to visit sightseeing', first.state, 1);
    expect(second.state.attractionsRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      attractionsRequested: false,
    });
    expect(first.state.attractionsRequested).toBe(false);

    const second = turn('sightseeing landmarks museums', first.state, 1);
    expect(second.state.attractionsRequested).toBe(false);
  });

  it('unsupported attractions-adjacent wording cannot set attractionsRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'landmarks',
      'museums',
      'sightseeing',
      'attraction tickets',
      'attraction opening hours',
      'Sydney Opera House',
      'attraction weather',
      'attractions?',
      'I liked the attraction',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.attractionsRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit attractions cue in the message sets attractionsRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('attraction options', initial, 0);
    expect(result.state.attractionsRequested).toBe(true);
  });

  it('phase 8V clear attractions-discovery cues set attractionsRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const options = turn('attraction options', initial, 0);
    expect(options.state.attractionsRequested).toBe(true);
    expect(options.state.activitiesRequested).toBeNull();
    expect(options.state.restaurantsRequested).toBeNull();
    expect(options.state.nearbyDiscoveryRequested).toBeNull();
    expect(options.state.scenicDrivesRequested).toBeNull();

    const tourist = turn('tourist attractions', initial, 1);
    expect(tourist.state.attractionsRequested).toBe(true);
    expect(tourist.state.activitiesRequested).toBeNull();

    const things = turn('things to see', initial, 2);
    expect(things.state.attractionsRequested).toBe(true);

    const places = turn('places to visit', initial, 3);
    expect(places.state.attractionsRequested).toBe(true);

    const see = turn('what should I see', initial, 4);
    expect(see.state.attractionsRequested).toBe(true);

    const inRequest = turn(
      'show me tourist attractions in Brisbane. Fly from Sydney to Brisbane',
      initial,
      5,
    );
    expect(inRequest.state.attractionsRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 6, {
      attractionsRequested: false,
    });
    const negated = turn('no attractions', seeded.state, 7);
    expect(negated.state.attractionsRequested).toBe(false);
    const tickets = turn('attraction tickets', seeded.state, 8);
    expect(tickets.state.attractionsRequested).toBe(false);
    const named = turn('Sydney Opera House', seeded.state, 9);
    expect(named.state.attractionsRequested).toBe(false);
    const weather = turn('attraction weather', seeded.state, 10);
    expect(weather.state.attractionsRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.attractionsRequested overrides an extracted attractions request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('attraction options', initial, 0, {
      attractionsRequested: false,
    });
    expect(overriddenFalse.state.attractionsRequested).toBe(false);

    const overriddenTrue = turn('no attractions', initial, 1, {
      attractionsRequested: true,
    });
    expect(overriddenTrue.state.attractionsRequested).toBe(true);

    const nullOverride = turn('attraction options', initial, 2, {
      attractionsRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.attractionsRequested).toBeNull();
  });

  it('unsupported wording preserves an existing attractionsRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      attractionsRequested: true,
    });
    expect(withTrue.state.attractionsRequested).toBe(true);

    const afterWords = turn('sightseeing landmarks museums', withTrue.state, 1);
    expect(afterWords.state.attractionsRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      attractionsRequested: false,
    });
    expect(withFalse.state.attractionsRequested).toBe(false);

    const afterMoreWords = turn(
      'attraction tickets attraction weather',
      withFalse.state,
      3,
    );
    expect(afterMoreWords.state.attractionsRequested).toBe(false);
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
    });
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

    const second = turn('no attractions', first.state, 1, {
      attractionsRequested: false,
    });
    expect(second.state.attractionsRequested).toBe(false);
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
      attractionsRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn(
      'attractions tourist attractions landmarks',
      first.state,
      1,
    );
    expect(second.state.attractionsRequested).toBe(true);
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
