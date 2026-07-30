import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-kayaking-requested-001';
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

describe('phase 3P — explicit kayakingRequested only', () => {
  it('initial kayakingRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.kayakingRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want kayaking', initial, 0, {
      kayakingRequested: true,
    });
    expect(result.state.kayakingRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need a kayak', initial, 0, {
      kayakingRequested: true,
    });
    expect(withTrue.state.kayakingRequested).toBe(true);

    const withFalse = turn('no kayaking', withTrue.state, 1, {
      kayakingRequested: false,
    });
    expect(withFalse.state.kayakingRequested).toBe(false);
    expect(withFalse.state.kayakingRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { kayakingRequested: true });
    expect(first.state.kayakingRequested).toBe(true);

    const second = turn('canoe paddle rafting', first.state, 1);
    expect(second.state.kayakingRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { kayakingRequested: false });
    expect(first.state.kayakingRequested).toBe(false);

    const second = turn('canoe paddle rafting', first.state, 1);
    expect(second.state.kayakingRequested).toBe(false);
  });

  it('unsupported kayaking-adjacent wording cannot set kayakingRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'canoe',
      'paddle',
      'paddling',
      'rafting',
      'kayak gear',
      'kayaking weather',
      'hire a kayak',
      'Noosa Kayak Tours',
      'kayaking?',
      'I like kayaking',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.kayakingRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit kayaking cue in the message sets kayakingRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('show me kayaking', initial, 0);
    expect(result.state.kayakingRequested).toBe(true);
  });

  it('phase 8S clear kayaking-discovery cues set kayakingRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const bare = turn('kayaking', initial, 0);
    expect(bare.state.kayakingRequested).toBe(true);
    expect(bare.state.beachesRequested).toBeNull();
    expect(bare.state.campingRequested).toBeNull();
    expect(bare.state.nearbyDiscoveryRequested).toBeNull();
    expect(bare.state.activitiesRequested).toBeNull();

    const tours = turn('find kayak tours', initial, 1);
    expect(tours.state.kayakingRequested).toBe(true);

    const options = turn('kayaking options', initial, 2);
    expect(options.state.kayakingRequested).toBe(true);

    const places = turn('places to kayak', initial, 3);
    expect(places.state.kayakingRequested).toBe(true);

    const inRequest = turn(
      'show me kayaking near Brisbane. Fly from Sydney to Brisbane',
      initial,
      4,
    );
    expect(inRequest.state.kayakingRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 5, {
      kayakingRequested: false,
    });
    const negated = turn('no kayaking', seeded.state, 6);
    expect(negated.state.kayakingRequested).toBe(false);
    const gear = turn('kayak gear', seeded.state, 7);
    expect(gear.state.kayakingRequested).toBe(false);
    const hire = turn('hire a kayak', seeded.state, 8);
    expect(hire.state.kayakingRequested).toBe(false);
    const weather = turn('kayaking weather', seeded.state, 9);
    expect(weather.state.kayakingRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.kayakingRequested overrides an extracted kayaking request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('show me kayaking', initial, 0, {
      kayakingRequested: false,
    });
    expect(overriddenFalse.state.kayakingRequested).toBe(false);

    const overriddenTrue = turn('no kayaking', initial, 1, {
      kayakingRequested: true,
    });
    expect(overriddenTrue.state.kayakingRequested).toBe(true);

    const nullOverride = turn('show me kayaking', initial, 2, {
      kayakingRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.kayakingRequested).toBeNull();
  });

  it('unsupported wording preserves an existing kayakingRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, { kayakingRequested: true });
    expect(withTrue.state.kayakingRequested).toBe(true);

    const afterWords = turn('canoe paddle rafting', withTrue.state, 1);
    expect(afterWords.state.kayakingRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      kayakingRequested: false,
    });
    expect(withFalse.state.kayakingRequested).toBe(false);

    const afterMoreWords = turn('paddling canoe hire a kayak', withFalse.state, 3);
    expect(afterMoreWords.state.kayakingRequested).toBe(false);
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
    });
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

    const second = turn('no kayaking', first.state, 1, {
      kayakingRequested: false,
    });
    expect(second.state.kayakingRequested).toBe(false);
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
      kayakingRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(first.reply);
    expect(first.reply).toBe(first.state.transcript.at(-1)?.message);
    expect(first.reply).not.toMatch(/assembled|unavailable/i);

    const second = turn('canoe paddle rafting', first.state, 1);
    expect(second.state.kayakingRequested).toBe(true);
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
