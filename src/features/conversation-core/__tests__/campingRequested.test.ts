import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-camping-requested-001';
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

describe('phase 3O — explicit campingRequested only', () => {
  it('initial campingRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.campingRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want camping', initial, 0, {
      campingRequested: true,
    });
    expect(result.state.campingRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need a campsite', initial, 0, {
      campingRequested: true,
    });
    expect(withTrue.state.campingRequested).toBe(true);

    const withFalse = turn('no camping', withTrue.state, 1, {
      campingRequested: false,
    });
    expect(withFalse.state.campingRequested).toBe(false);
    expect(withFalse.state.campingRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { campingRequested: true });
    expect(first.state.campingRequested).toBe(true);

    const second = turn('caravan tent glamping', first.state, 1);
    expect(second.state.campingRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { campingRequested: false });
    expect(first.state.campingRequested).toBe(false);

    const second = turn('caravan tent glamping', first.state, 1);
    expect(second.state.campingRequested).toBe(false);
  });

  it('unsupported camping-adjacent wording cannot set campingRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'caravan',
      'tent',
      'glamping',
      'camping gear',
      'camping weather',
      'camping permit',
      'camping?',
      'I like camping',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.campingRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit camping cue in the message sets campingRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('show me camping', initial, 0);
    expect(result.state.campingRequested).toBe(true);
  });

  it('phase 8P clear camping-discovery cues set campingRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const bare = turn('camping', initial, 0);
    expect(bare.state.campingRequested).toBe(true);
    expect(bare.state.beachesRequested).toBeNull();
    expect(bare.state.nearbyDiscoveryRequested).toBeNull();
    expect(bare.state.activitiesRequested).toBeNull();

    const campsites = turn('find campsites', initial, 1);
    expect(campsites.state.campingRequested).toBe(true);

    const options = turn('camping options', initial, 2);
    expect(options.state.campingRequested).toBe(true);

    const nearbyCamping = turn('nearby camping', initial, 3);
    expect(nearbyCamping.state.campingRequested).toBe(true);

    const inRequest = turn(
      'show me camping near Brisbane. Fly from Sydney to Brisbane',
      initial,
      4,
    );
    expect(inRequest.state.campingRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 5, {
      campingRequested: false,
    });
    const negated = turn('no camping', seeded.state, 6);
    expect(negated.state.campingRequested).toBe(false);
    const equipment = turn('camping gear', seeded.state, 7);
    expect(equipment.state.campingRequested).toBe(false);
    const weather = turn('camping weather', seeded.state, 8);
    expect(weather.state.campingRequested).toBe(false);
    const historical = turn('we went camping', seeded.state, 9);
    expect(historical.state.campingRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.campingRequested overrides an extracted camping request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('show me camping', initial, 0, {
      campingRequested: false,
    });
    expect(overriddenFalse.state.campingRequested).toBe(false);

    const overriddenTrue = turn('no camping', initial, 1, {
      campingRequested: true,
    });
    expect(overriddenTrue.state.campingRequested).toBe(true);

    const nullOverride = turn('show me camping', initial, 2, {
      campingRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.campingRequested).toBeNull();
  });

  it('unsupported wording preserves an existing campingRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, { campingRequested: true });
    expect(withTrue.state.campingRequested).toBe(true);

    const afterCaravan = turn('I want a caravan park', withTrue.state, 1);
    expect(afterCaravan.state.campingRequested).toBe(true);

    const withFalse = turn('change', afterCaravan.state, 2, {
      campingRequested: false,
    });
    expect(withFalse.state.campingRequested).toBe(false);

    const afterMoreWords = turn('camping gear', withFalse.state, 3);
    expect(afterMoreWords.state.campingRequested).toBe(false);
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
    });
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

    const second = turn('no camping', first.state, 1, {
      campingRequested: false,
    });
    expect(second.state.campingRequested).toBe(false);
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
      campingRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(first.reply);
    expect(first.reply).toBe(first.state.transcript.at(-1)?.message);
    expect(first.reply).not.toMatch(/assembled|unavailable/i);

    const second = turn('caravan tent glamping', first.state, 1);
    expect(second.state.campingRequested).toBe(true);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript[0]).toEqual(first.state.transcript[0]);
    expect(second.state.transcript[1]).toEqual(first.state.transcript[1]);
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
