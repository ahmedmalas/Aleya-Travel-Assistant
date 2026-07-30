import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-four-wheel-drive-requested-001';
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

describe('phase 3Q — explicit fourWheelDriveRequested only', () => {
  it('initial fourWheelDriveRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.fourWheelDriveRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want 4WD', initial, 0, {
      fourWheelDriveRequested: true,
    });
    expect(result.state.fourWheelDriveRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need four-wheel drive', initial, 0, {
      fourWheelDriveRequested: true,
    });
    expect(withTrue.state.fourWheelDriveRequested).toBe(true);

    const withFalse = turn('no 4WD', withTrue.state, 1, {
      fourWheelDriveRequested: false,
    });
    expect(withFalse.state.fourWheelDriveRequested).toBe(false);
    expect(withFalse.state.fourWheelDriveRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      fourWheelDriveRequested: true,
    });
    expect(first.state.fourWheelDriveRequested).toBe(true);

    const second = turn('off-road off-roading', first.state, 1);
    expect(second.state.fourWheelDriveRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      fourWheelDriveRequested: false,
    });
    expect(first.state.fourWheelDriveRequested).toBe(false);

    const second = turn('SUV off-road hire a 4WD', first.state, 1);
    expect(second.state.fourWheelDriveRequested).toBe(false);
  });

  it('unsupported four-wheel-driving-adjacent wording cannot set fourWheelDriveRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'SUV',
      'four-wheel drive',
      'off-road',
      'off-roading',
      '4wd hire',
      '4wd equipment',
      '4wd track conditions',
      'Finke Desert Race',
      '4wd?',
      'I like 4wding',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.fourWheelDriveRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit four-wheel-driving cue in the message sets fourWheelDriveRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('show me 4wd tracks', initial, 0);
    expect(result.state.fourWheelDriveRequested).toBe(true);
  });

  it('phase 8T clear four-wheel-driving-discovery cues set fourWheelDriveRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const bare = turn('4wd', initial, 0);
    expect(bare.state.fourWheelDriveRequested).toBe(true);
    expect(bare.state.carHireRequested).toBeNull();
    expect(bare.state.campingRequested).toBeNull();
    expect(bare.state.nearbyDiscoveryRequested).toBeNull();
    expect(bare.state.activitiesRequested).toBeNull();

    const fourByFour = turn('4x4', initial, 1);
    expect(fourByFour.state.fourWheelDriveRequested).toBe(true);

    const offRoad = turn('off road driving', initial, 2);
    expect(offRoad.state.fourWheelDriveRequested).toBe(true);

    const options = turn('4wd options', initial, 3);
    expect(options.state.fourWheelDriveRequested).toBe(true);

    const places = turn('places to go four wheel driving', initial, 4);
    expect(places.state.fourWheelDriveRequested).toBe(true);

    const inRequest = turn(
      'show me 4wd tracks near Brisbane. Fly from Sydney to Brisbane',
      initial,
      5,
    );
    expect(inRequest.state.fourWheelDriveRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 6, {
      fourWheelDriveRequested: false,
    });
    const negated = turn('no 4wding', seeded.state, 7);
    expect(negated.state.fourWheelDriveRequested).toBe(false);
    const hire = turn('hire a 4WD', seeded.state, 8);
    expect(hire.state.fourWheelDriveRequested).toBe(false);
    const gear = turn('4wd recovery gear', seeded.state, 9);
    expect(gear.state.fourWheelDriveRequested).toBe(false);
    const conditions = turn('4wd track conditions', seeded.state, 10);
    expect(conditions.state.fourWheelDriveRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.fourWheelDriveRequested overrides an extracted four-wheel-driving request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('show me 4wd tracks', initial, 0, {
      fourWheelDriveRequested: false,
    });
    expect(overriddenFalse.state.fourWheelDriveRequested).toBe(false);

    const overriddenTrue = turn('no 4WD', initial, 1, {
      fourWheelDriveRequested: true,
    });
    expect(overriddenTrue.state.fourWheelDriveRequested).toBe(true);

    const nullOverride = turn('show me 4wd tracks', initial, 2, {
      fourWheelDriveRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.fourWheelDriveRequested).toBeNull();
  });

  it('unsupported wording preserves an existing fourWheelDriveRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      fourWheelDriveRequested: true,
    });
    expect(withTrue.state.fourWheelDriveRequested).toBe(true);

    const afterWords = turn('SUV off-road hire a 4WD', withTrue.state, 1);
    expect(afterWords.state.fourWheelDriveRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      fourWheelDriveRequested: false,
    });
    expect(withFalse.state.fourWheelDriveRequested).toBe(false);

    const afterMoreWords = turn(
      '4wd equipment off road weather',
      withFalse.state,
      3,
    );
    expect(afterMoreWords.state.fourWheelDriveRequested).toBe(false);
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
    });
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

    const second = turn('no 4WD', first.state, 1, {
      fourWheelDriveRequested: false,
    });
    expect(second.state.fourWheelDriveRequested).toBe(false);
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
      fourWheelDriveRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('4WD four-wheel drive off-road', first.state, 1);
    expect(second.state.fourWheelDriveRequested).toBe(true);
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
