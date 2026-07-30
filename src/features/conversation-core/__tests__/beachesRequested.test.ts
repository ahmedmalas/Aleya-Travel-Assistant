import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-beaches-requested-001';
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

describe('phase 3N — explicit beachesRequested only', () => {
  it('initial beachesRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.beachesRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want beaches', initial, 0, {
      beachesRequested: true,
    });
    expect(result.state.beachesRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need a beach', initial, 0, {
      beachesRequested: true,
    });
    expect(withTrue.state.beachesRequested).toBe(true);

    const withFalse = turn('no beaches', withTrue.state, 1, {
      beachesRequested: false,
    });
    expect(withFalse.state.beachesRequested).toBe(false);
    expect(withFalse.state.beachesRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { beachesRequested: true });
    expect(first.state.beachesRequested).toBe(true);

    const second = turn('coast ocean swimming', first.state, 1);
    expect(second.state.beachesRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { beachesRequested: false });
    expect(first.state.beachesRequested).toBe(false);

    const second = turn('coast ocean swimming', first.state, 1);
    expect(second.state.beachesRequested).toBe(false);
  });

  it('unsupported beach-adjacent wording cannot set beachesRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'coast',
      'ocean',
      'swimming',
      'seaside',
      'lagoon',
      'hotel near the beach',
      'beach weather',
      'Bondi Beach',
      'beaches?',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.beachesRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit beaches cue in the message sets beachesRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('show me beaches', initial, 0);
    expect(result.state.beachesRequested).toBe(true);
  });

  it('phase 8N clear beach-discovery cues set beachesRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const singular = turn('beach', initial, 0);
    expect(singular.state.beachesRequested).toBe(true);
    expect(singular.state.nearbyDiscoveryRequested).toBeNull();
    expect(singular.state.activitiesRequested).toBeNull();
    expect(singular.state.restaurantsRequested).toBeNull();

    const best = turn('best beaches', initial, 1);
    expect(best.state.beachesRequested).toBe(true);

    const swim = turn('places to swim', initial, 2);
    expect(swim.state.beachesRequested).toBe(true);

    const nearbyBeaches = turn('nearby beaches', initial, 3);
    expect(nearbyBeaches.state.beachesRequested).toBe(true);

    const inRequest = turn(
      'show me beaches in Brisbane. Fly from Sydney to Brisbane',
      initial,
      4,
    );
    expect(inRequest.state.beachesRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 5, {
      beachesRequested: false,
    });
    const negated = turn('no beaches', seeded.state, 6);
    expect(negated.state.beachesRequested).toBe(false);
    const proximity = turn('hotel near the beach', seeded.state, 7);
    expect(proximity.state.beachesRequested).toBe(false);
    const named = turn('Bondi Beach', seeded.state, 8);
    expect(named.state.beachesRequested).toBe(false);
    const weather = turn('beach weather', seeded.state, 9);
    expect(weather.state.beachesRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.beachesRequested overrides an extracted beaches request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('show me beaches', initial, 0, {
      beachesRequested: false,
    });
    expect(overriddenFalse.state.beachesRequested).toBe(false);

    const overriddenTrue = turn('no beaches', initial, 1, {
      beachesRequested: true,
    });
    expect(overriddenTrue.state.beachesRequested).toBe(true);

    const nullOverride = turn('show me beaches', initial, 2, {
      beachesRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.beachesRequested).toBeNull();
  });

  it('unsupported wording preserves an existing beachesRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, { beachesRequested: true });
    expect(withTrue.state.beachesRequested).toBe(true);

    const afterCoast = turn('I want to visit the coast', withTrue.state, 1);
    expect(afterCoast.state.beachesRequested).toBe(true);

    const withFalse = turn('change', afterCoast.state, 2, {
      beachesRequested: false,
    });
    expect(withFalse.state.beachesRequested).toBe(false);

    const afterMoreWords = turn('swimming by the coast', withFalse.state, 3);
    expect(afterMoreWords.state.beachesRequested).toBe(false);
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
    });
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

    const second = turn('no beaches', first.state, 1, {
      beachesRequested: false,
    });
    expect(second.state.beachesRequested).toBe(false);
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
      beachesRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(first.reply);
    expect(first.reply).toBe(first.state.transcript.at(-1)?.message);
    expect(first.reply).not.toMatch(/assembled|unavailable/i);

    const second = turn('coast ocean swimming', first.state, 1);
    expect(second.state.beachesRequested).toBe(true);
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
