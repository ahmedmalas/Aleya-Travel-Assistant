import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-scenic-drives-requested-001';
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

describe('phase 3R — explicit scenicDrivesRequested only', () => {
  it('initial scenicDrivesRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.scenicDrivesRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want a scenic drive', initial, 0, {
      scenicDrivesRequested: true,
    });
    expect(result.state.scenicDrivesRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need a road trip', initial, 0, {
      scenicDrivesRequested: true,
    });
    expect(withTrue.state.scenicDrivesRequested).toBe(true);

    const withFalse = turn('no coastal drive', withTrue.state, 1, {
      scenicDrivesRequested: false,
    });
    expect(withFalse.state.scenicDrivesRequested).toBe(false);
    expect(withFalse.state.scenicDrivesRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      scenicDrivesRequested: true,
    });
    expect(first.state.scenicDrivesRequested).toBe(true);

    const second = turn('driving route lookout drive', first.state, 1);
    expect(second.state.scenicDrivesRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      scenicDrivesRequested: false,
    });
    expect(first.state.scenicDrivesRequested).toBe(false);

    const second = turn('coastal drive lookout drive', first.state, 1);
    expect(second.state.scenicDrivesRequested).toBe(false);
  });

  it('unsupported scenic-drive-adjacent wording cannot set scenicDrivesRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'coastal drive',
      'mountain drive',
      'lookout drive',
      'scenic drive map',
      'road conditions',
      'Great Ocean Road',
      'car hire for a road trip',
      'scenic drives?',
      'I like scenic drives',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.scenicDrivesRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit scenic-drive cue in the message sets scenicDrivesRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('show me scenic drives', initial, 0);
    expect(result.state.scenicDrivesRequested).toBe(true);
  });

  it('phase 8U clear scenic-drive-discovery cues set scenicDrivesRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const bare = turn('scenic drives', initial, 0);
    expect(bare.state.scenicDrivesRequested).toBe(true);
    expect(bare.state.carHireRequested).toBeNull();
    expect(bare.state.beachesRequested).toBeNull();
    expect(bare.state.nearbyDiscoveryRequested).toBeNull();
    expect(bare.state.activitiesRequested).toBeNull();
    expect(bare.state.fourWheelDriveRequested).toBeNull();

    const routes = turn('scenic routes', initial, 1);
    expect(routes.state.scenicDrivesRequested).toBe(true);

    const roadTrip = turn('road trips', initial, 2);
    expect(roadTrip.state.scenicDrivesRequested).toBe(true);

    const options = turn('scenic drive options', initial, 3);
    expect(options.state.scenicDrivesRequested).toBe(true);

    const places = turn('places to drive', initial, 4);
    expect(places.state.scenicDrivesRequested).toBe(true);

    const inRequest = turn(
      'show me scenic drives near Brisbane. Fly from Sydney to Brisbane',
      initial,
      5,
    );
    expect(inRequest.state.scenicDrivesRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 6, {
      scenicDrivesRequested: false,
    });
    const negated = turn('no scenic drives', seeded.state, 7);
    expect(negated.state.scenicDrivesRequested).toBe(false);
    const map = turn('scenic drive map', seeded.state, 8);
    expect(map.state.scenicDrivesRequested).toBe(false);
    const hire = turn('car hire for a road trip', seeded.state, 9);
    expect(hire.state.scenicDrivesRequested).toBe(false);
    const named = turn('Great Ocean Road', seeded.state, 10);
    expect(named.state.scenicDrivesRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.scenicDrivesRequested overrides an extracted scenic-drive request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('show me scenic drives', initial, 0, {
      scenicDrivesRequested: false,
    });
    expect(overriddenFalse.state.scenicDrivesRequested).toBe(false);

    const overriddenTrue = turn('no scenic drives', initial, 1, {
      scenicDrivesRequested: true,
    });
    expect(overriddenTrue.state.scenicDrivesRequested).toBe(true);

    const nullOverride = turn('show me scenic drives', initial, 2, {
      scenicDrivesRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.scenicDrivesRequested).toBeNull();
  });

  it('unsupported wording preserves an existing scenicDrivesRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      scenicDrivesRequested: true,
    });
    expect(withTrue.state.scenicDrivesRequested).toBe(true);

    const afterWords = turn('coastal drive lookout drive', withTrue.state, 1);
    expect(afterWords.state.scenicDrivesRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      scenicDrivesRequested: false,
    });
    expect(withFalse.state.scenicDrivesRequested).toBe(false);

    const afterMoreWords = turn(
      'scenic drive map road conditions',
      withFalse.state,
      3,
    );
    expect(afterMoreWords.state.scenicDrivesRequested).toBe(false);
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
    });
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

    const second = turn('no scenic drive', first.state, 1, {
      scenicDrivesRequested: false,
    });
    expect(second.state.scenicDrivesRequested).toBe(false);
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
      scenicDrivesRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('scenic drive road trip coastal drive', first.state, 1);
    expect(second.state.scenicDrivesRequested).toBe(true);
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
