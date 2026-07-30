import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-restaurants-requested-001';
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

describe('phase 3L — explicit restaurantsRequested only', () => {
  it('initial restaurantsRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.restaurantsRequested).toBeNull();
  });

  it('injected true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want restaurants', initial, 0, {
      restaurantsRequested: true,
    });
    expect(result.state.restaurantsRequested).toBe(true);
  });

  it('injected false is stored and not treated as omitted', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need dining', initial, 0, {
      restaurantsRequested: true,
    });
    expect(withTrue.state.restaurantsRequested).toBe(true);

    const withFalse = turn('no restaurants', withTrue.state, 1, {
      restaurantsRequested: false,
    });
    expect(withFalse.state.restaurantsRequested).toBe(false);
    expect(withFalse.state.restaurantsRequested).not.toBeNull();
  });

  it('omitting restaurantsRequested preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { restaurantsRequested: true });
    expect(first.state.restaurantsRequested).toBe(true);

    const second = turn('food dinner lunch', first.state, 1);
    expect(second.state.restaurantsRequested).toBe(true);

    const third = turn('Hello', second.state, 2, {
      restaurantsRequested: false,
    });
    expect(third.state.restaurantsRequested).toBe(false);

    const fourth = turn('cafe dining food', third.state, 3);
    expect(fourth.state.restaurantsRequested).toBe(false);
  });

  it('a later injected value replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { restaurantsRequested: false });
    expect(first.state.restaurantsRequested).toBe(false);

    const second = turn('change', first.state, 1, {
      restaurantsRequested: true,
    });
    expect(second.state.restaurantsRequested).toBe(true);
  });

  it('message text alone never changes restaurantsRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'dining',
      'food',
      'dinner',
      'lunch',
      'cafe',
      'Italian cuisine',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.restaurantsRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit restaurant-request cue in the message sets restaurantsRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I need restaurants', initial, 0);
    expect(result.state.restaurantsRequested).toBe(true);
  });

  it('phase 8L clear restaurant cues set restaurantsRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const placesToEat = turn('places to eat', initial, 0);
    expect(placesToEat.state.restaurantsRequested).toBe(true);
    expect(placesToEat.state.activitiesRequested).toBeNull();
    expect(placesToEat.state.nearbyDiscoveryRequested).toBeNull();

    const dining = turn('dining options', initial, 1);
    expect(dining.state.restaurantsRequested).toBe(true);

    const recommendations = turn('restaurant recommendations', initial, 2);
    expect(recommendations.state.restaurantsRequested).toBe(true);

    const inRequest = turn(
      'find restaurants. Fly from Sydney to Brisbane',
      initial,
      3,
    );
    expect(inRequest.state.restaurantsRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 4, {
      restaurantsRequested: false,
    });
    const negated = turn('no restaurants', seeded.state, 5);
    expect(negated.state.restaurantsRequested).toBe(false);
    const metadata = turn('restaurant menu', seeded.state, 6);
    expect(metadata.state.restaurantsRequested).toBe(false);
    const preference = turn('I like Italian food', seeded.state, 7);
    expect(preference.state.restaurantsRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.restaurantsRequested overrides an extracted restaurant request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('find restaurants', initial, 0, {
      restaurantsRequested: false,
    });
    expect(overriddenFalse.state.restaurantsRequested).toBe(false);

    const overriddenTrue = turn('no restaurants', initial, 1, {
      restaurantsRequested: true,
    });
    expect(overriddenTrue.state.restaurantsRequested).toBe(true);

    const nullOverride = turn('find restaurants', initial, 2, {
      restaurantsRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.restaurantsRequested).toBeNull();
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
    });
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

    const second = turn('no restaurants', first.state, 1, {
      restaurantsRequested: false,
    });
    expect(second.state.restaurantsRequested).toBe(false);
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
    expect(second.reply).toBe(second.state.transcript.at(-1)?.message);
    expect(second.reply).not.toMatch(/assembled|unavailable/i);
  });
});
