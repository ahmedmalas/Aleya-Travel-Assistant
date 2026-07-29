import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-nearby-discovery-requested-001';
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

describe('phase 3M — explicit nearbyDiscoveryRequested only', () => {
  it('initial nearbyDiscoveryRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.nearbyDiscoveryRequested).toBeNull();
  });

  it('injected true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('near me', initial, 0, {
      nearbyDiscoveryRequested: true,
    });
    expect(result.state.nearbyDiscoveryRequested).toBe(true);
  });

  it('injected false is stored and not treated as omitted', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('things nearby', initial, 0, {
      nearbyDiscoveryRequested: true,
    });
    expect(withTrue.state.nearbyDiscoveryRequested).toBe(true);

    const withFalse = turn('no nearby', withTrue.state, 1, {
      nearbyDiscoveryRequested: false,
    });
    expect(withFalse.state.nearbyDiscoveryRequested).toBe(false);
    expect(withFalse.state.nearbyDiscoveryRequested).not.toBeNull();
  });

  it('omitting nearbyDiscoveryRequested preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      nearbyDiscoveryRequested: true,
    });
    expect(first.state.nearbyDiscoveryRequested).toBe(true);

    const second = turn('around here', first.state, 1);
    expect(second.state.nearbyDiscoveryRequested).toBe(true);

    const third = turn('Hello', second.state, 2, {
      nearbyDiscoveryRequested: false,
    });
    expect(third.state.nearbyDiscoveryRequested).toBe(false);

    const fourth = turn('what is close', third.state, 3);
    expect(fourth.state.nearbyDiscoveryRequested).toBe(false);
  });

  it('a later injected value replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      nearbyDiscoveryRequested: false,
    });
    expect(first.state.nearbyDiscoveryRequested).toBe(false);

    const second = turn('change', first.state, 1, {
      nearbyDiscoveryRequested: true,
    });
    expect(second.state.nearbyDiscoveryRequested).toBe(true);
  });

  it('message text alone never changes nearbyDiscoveryRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'nearby',
      'close',
      'around',
      'around here',
      'what is close',
      'hotel near the beach',
      'Surfers Paradise',
      'nearest station',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.nearbyDiscoveryRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit nearby-discovery cue in the message sets nearbyDiscoveryRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('what is nearby', initial, 0);
    expect(result.state.nearbyDiscoveryRequested).toBe(true);
  });

  it('phase 8M clear nearby-discovery cues set nearbyDiscoveryRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const aroundMe = turn('what is around me', initial, 0);
    expect(aroundMe.state.nearbyDiscoveryRequested).toBe(true);
    expect(aroundMe.state.activitiesRequested).toBeNull();
    expect(aroundMe.state.restaurantsRequested).toBeNull();

    const placesNearMe = turn('places near me', initial, 1);
    expect(placesNearMe.state.nearbyDiscoveryRequested).toBe(true);

    const closeBy = turn('places close by', initial, 2);
    expect(closeBy.state.nearbyDiscoveryRequested).toBe(true);

    const inRequest = turn(
      'show me what is nearby in Brisbane. Fly from Sydney to Brisbane',
      initial,
      3,
    );
    expect(inRequest.state.nearbyDiscoveryRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 4, {
      nearbyDiscoveryRequested: false,
    });
    const negated = turn('no nearby discovery', seeded.state, 5);
    expect(negated.state.nearbyDiscoveryRequested).toBe(false);
    const bare = turn('nearby', seeded.state, 6);
    expect(bare.state.nearbyDiscoveryRequested).toBe(false);
    const constraint = turn('hotel near the beach', seeded.state, 7);
    expect(constraint.state.nearbyDiscoveryRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.nearbyDiscoveryRequested overrides an extracted nearby-discovery request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('what is nearby', initial, 0, {
      nearbyDiscoveryRequested: false,
    });
    expect(overriddenFalse.state.nearbyDiscoveryRequested).toBe(false);

    const overriddenTrue = turn('no nearby discovery', initial, 1, {
      nearbyDiscoveryRequested: true,
    });
    expect(overriddenTrue.state.nearbyDiscoveryRequested).toBe(true);

    const nullOverride = turn('what is nearby', initial, 2, {
      nearbyDiscoveryRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.nearbyDiscoveryRequested).toBeNull();
  });

  it('all existing request flags and earlier fields remain preserved', () => {
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
    });
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

    const second = turn('no nearby', first.state, 1, {
      nearbyDiscoveryRequested: false,
    });
    expect(second.state.nearbyDiscoveryRequested).toBe(false);
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
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
