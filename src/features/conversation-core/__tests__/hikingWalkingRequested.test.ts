import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-hiking-walking-requested-001';
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

describe('phase 3U/7U — explicit hikingWalkingRequested with extraction activation', () => {
  it('initial hikingWalkingRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.hikingWalkingRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want hiking', initial, 0, {
      hikingWalkingRequested: true,
    });
    expect(result.state.hikingWalkingRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need trails', initial, 0, {
      hikingWalkingRequested: true,
    });
    expect(withTrue.state.hikingWalkingRequested).toBe(true);

    const withFalse = turn('no trails', withTrue.state, 1, {
      hikingWalkingRequested: false,
    });
    expect(withFalse.state.hikingWalkingRequested).toBe(false);
    expect(withFalse.state.hikingWalkingRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      hikingWalkingRequested: true,
    });
    expect(first.state.hikingWalkingRequested).toBe(true);

    const second = turn('walking directions walkable', first.state, 1);
    expect(second.state.hikingWalkingRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      hikingWalkingRequested: false,
    });
    expect(first.state.hikingWalkingRequested).toBe(false);

    const second = turn('trekking bushwalking walkable', first.state, 1);
    expect(second.state.hikingWalkingRequested).toBe(false);
  });

  it('unsupported hiking-adjacent wording cannot set hikingWalkingRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'trekking',
      'bushwalking',
      'walking directions',
      'walking distance',
      'walkable',
      'go for a walk',
      'hiking gear',
      'hiking weather',
      'Overland Track',
      'hiking?',
      'I like hiking',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.hikingWalkingRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit hiking cue in the message sets hikingWalkingRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('show me hiking', initial, 0);
    expect(result.state.hikingWalkingRequested).toBe(true);
  });

  it('phase 8R clear hiking-discovery cues set hikingWalkingRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const bare = turn('hiking', initial, 0);
    expect(bare.state.hikingWalkingRequested).toBe(true);
    expect(bare.state.campingRequested).toBeNull();
    expect(bare.state.nationalParksRequested).toBeNull();
    expect(bare.state.nearbyDiscoveryRequested).toBeNull();
    expect(bare.state.activitiesRequested).toBeNull();

    const hikes = turn('best hikes', initial, 1);
    expect(hikes.state.hikingWalkingRequested).toBe(true);

    const trails = turn('show me hiking trails', initial, 2);
    expect(trails.state.hikingWalkingRequested).toBe(true);

    const places = turn('places to hike', initial, 3);
    expect(places.state.hikingWalkingRequested).toBe(true);

    const inRequest = turn(
      'show me hiking trails near Brisbane. Fly from Sydney to Brisbane',
      initial,
      4,
    );
    expect(inRequest.state.hikingWalkingRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 5, {
      hikingWalkingRequested: false,
    });
    const negated = turn('no hiking', seeded.state, 6);
    expect(negated.state.hikingWalkingRequested).toBe(false);
    const gear = turn('hiking gear', seeded.state, 7);
    expect(gear.state.hikingWalkingRequested).toBe(false);
    const named = turn('Overland Track', seeded.state, 8);
    expect(named.state.hikingWalkingRequested).toBe(false);
    const weather = turn('hiking weather', seeded.state, 9);
    expect(weather.state.hikingWalkingRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.hikingWalkingRequested overrides an extracted hiking request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('show me hiking', initial, 0, {
      hikingWalkingRequested: false,
    });
    expect(overriddenFalse.state.hikingWalkingRequested).toBe(false);

    const overriddenTrue = turn('no hiking', initial, 1, {
      hikingWalkingRequested: true,
    });
    expect(overriddenTrue.state.hikingWalkingRequested).toBe(true);

    const nullOverride = turn('show me hiking', initial, 2, {
      hikingWalkingRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.hikingWalkingRequested).toBeNull();
  });

  it('unsupported wording preserves an existing hikingWalkingRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      hikingWalkingRequested: true,
    });
    expect(withTrue.state.hikingWalkingRequested).toBe(true);

    const afterWords = turn('walking directions walkable', withTrue.state, 1);
    expect(afterWords.state.hikingWalkingRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      hikingWalkingRequested: false,
    });
    expect(withFalse.state.hikingWalkingRequested).toBe(false);

    const afterMoreWords = turn(
      'walking directions walkable bushwalking',
      withFalse.state,
      3,
    );
    expect(afterMoreWords.state.hikingWalkingRequested).toBe(false);
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
    });
    expect(first.state.hikingWalkingRequested).toBe(true);
    expect(first.state.snowActivitiesRequested).toBe(true);
    expect(first.state.attractionsRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);

    const second = turn('no hiking', first.state, 1, {
      hikingWalkingRequested: false,
    });
    expect(second.state.hikingWalkingRequested).toBe(false);
    expect(second.state.snowActivitiesRequested).toBe(true);
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.turnCount).toBe(2);
  });

  it('existing transcript behaviour remains unchanged', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0, {
      hikingWalkingRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('walking directions walkable', first.state, 1);
    expect(second.state.hikingWalkingRequested).toBe(true);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
