import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-national-parks-requested-001';
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
    snowActivitiesRequested?: boolean;
    hikingWalkingRequested?: boolean;
    fishingRequested?: boolean;
    divingSnorkellingRequested?: boolean;
    wineriesFoodTrailsRequested?: boolean;
    eventsFestivalsRequested?: boolean;
    wildlifeRequested?: boolean;
    nationalParksRequested?: boolean;
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

describe('phase 3AA/7AA — explicit nationalParksRequested with extraction activation', () => {
  it('initial nationalParksRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.nationalParksRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want national parks', initial, 0, {
      nationalParksRequested: true,
    });
    expect(result.state.nationalParksRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need playgrounds', initial, 0, {
      nationalParksRequested: true,
    });
    expect(withTrue.state.nationalParksRequested).toBe(true);

    const withFalse = turn('no playgrounds', withTrue.state, 1, {
      nationalParksRequested: false,
    });
    expect(withFalse.state.nationalParksRequested).toBe(false);
    expect(withFalse.state.nationalParksRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      nationalParksRequested: true,
    });
    expect(first.state.nationalParksRequested).toBe(true);

    const second = turn('parks gardens playgrounds', first.state, 1);
    expect(second.state.nationalParksRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      nationalParksRequested: false,
    });
    expect(first.state.nationalParksRequested).toBe(false);

    const second = turn('state parks conservation areas', first.state, 1);
    expect(second.state.nationalParksRequested).toBe(false);
  });

  it('unsupported national-park-adjacent wording cannot set nationalParksRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'parks',
      'playground',
      'gardens',
      'reserves',
      'state parks',
      'conservation areas',
      'Sydney',
      'Kakadu National Park',
      'national park weather',
      'national park permit',
      'national parks?',
      'I like national parks',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.nationalParksRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit national-parks cue in the message sets nationalParksRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('show me national parks', initial, 0);
    expect(result.state.nationalParksRequested).toBe(true);
  });

  it('phase 8Q clear national-park discovery cues set nationalParksRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const bare = turn('national parks', initial, 0);
    expect(bare.state.nationalParksRequested).toBe(true);
    expect(bare.state.campingRequested).toBeNull();
    expect(bare.state.beachesRequested).toBeNull();
    expect(bare.state.nearbyDiscoveryRequested).toBeNull();
    expect(bare.state.activitiesRequested).toBeNull();

    const best = turn('best national parks', initial, 1);
    expect(best.state.nationalParksRequested).toBe(true);

    const visit = turn('parks to visit', initial, 2);
    expect(visit.state.nationalParksRequested).toBe(true);

    const nearbyParks = turn('nearby national parks', initial, 3);
    expect(nearbyParks.state.nationalParksRequested).toBe(true);

    const inRequest = turn(
      'show me national parks near Brisbane. Fly from Sydney to Brisbane',
      initial,
      4,
    );
    expect(inRequest.state.nationalParksRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 5, {
      nationalParksRequested: false,
    });
    const negated = turn('no national parks', seeded.state, 6);
    expect(negated.state.nationalParksRequested).toBe(false);
    const named = turn('Kakadu National Park', seeded.state, 7);
    expect(named.state.nationalParksRequested).toBe(false);
    const weather = turn('national park weather', seeded.state, 8);
    expect(weather.state.nationalParksRequested).toBe(false);
    const hotel = turn('hotel near a national park', seeded.state, 9);
    expect(hotel.state.nationalParksRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.nationalParksRequested overrides an extracted national-parks request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('show me national parks', initial, 0, {
      nationalParksRequested: false,
    });
    expect(overriddenFalse.state.nationalParksRequested).toBe(false);

    const overriddenTrue = turn('no national parks', initial, 1, {
      nationalParksRequested: true,
    });
    expect(overriddenTrue.state.nationalParksRequested).toBe(true);

    const nullOverride = turn('show me national parks', initial, 2, {
      nationalParksRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.nationalParksRequested).toBeNull();
  });

  it('unsupported wording preserves an existing nationalParksRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      nationalParksRequested: true,
    });
    expect(withTrue.state.nationalParksRequested).toBe(true);

    const afterWords = turn('state parks gardens playgrounds', withTrue.state, 1);
    expect(afterWords.state.nationalParksRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      nationalParksRequested: false,
    });
    expect(withFalse.state.nationalParksRequested).toBe(false);

    const afterMoreWords = turn(
      'parks reserves conservation areas Sydney',
      withFalse.state,
      3,
    );
    expect(afterMoreWords.state.nationalParksRequested).toBe(false);
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
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      wineriesFoodTrailsRequested: true,
      eventsFestivalsRequested: true,
      wildlifeRequested: true,
      nationalParksRequested: true,
    });
    expect(first.state.nationalParksRequested).toBe(true);
    expect(first.state.wildlifeRequested).toBe(true);
    expect(first.state.eventsFestivalsRequested).toBe(true);
    expect(first.state.wineriesFoodTrailsRequested).toBe(true);
    expect(first.state.divingSnorkellingRequested).toBe(true);
    expect(first.state.fishingRequested).toBe(true);
    expect(first.state.hikingWalkingRequested).toBe(true);
    expect(first.state.snowActivitiesRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);

    const second = turn('no national parks', first.state, 1, {
      nationalParksRequested: false,
    });
    expect(second.state.nationalParksRequested).toBe(false);
    expect(second.state.wildlifeRequested).toBe(true);
    expect(second.state.eventsFestivalsRequested).toBe(true);
    expect(second.state.wineriesFoodTrailsRequested).toBe(true);
    expect(second.state.divingSnorkellingRequested).toBe(true);
    expect(second.state.fishingRequested).toBe(true);
    expect(second.state.hikingWalkingRequested).toBe(true);
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.turnCount).toBe(2);
  });

  it('existing transcript behaviour remains unchanged', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0, {
      nationalParksRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('parks gardens playgrounds', first.state, 1);
    expect(second.state.nationalParksRequested).toBe(true);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
