import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-car-hire-requested-001';
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

describe('phase 3J — explicit carHireRequested only', () => {
  it('initial carHireRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.carHireRequested).toBeNull();
  });

  it('injected true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want a rental car', initial, 0, {
      carHireRequested: true,
    });
    expect(result.state.carHireRequested).toBe(true);
  });

  it('injected false is stored and not treated as omitted', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need a car', initial, 0, {
      carHireRequested: true,
    });
    expect(withTrue.state.carHireRequested).toBe(true);

    const withFalse = turn('no hire', withTrue.state, 1, {
      carHireRequested: false,
    });
    expect(withFalse.state.carHireRequested).toBe(false);
    expect(withFalse.state.carHireRequested).not.toBeNull();
  });

  it('omitting carHireRequested preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { carHireRequested: true });
    expect(first.state.carHireRequested).toBe(true);

    const second = turn('car vehicle rental', first.state, 1);
    expect(second.state.carHireRequested).toBe(true);

    const third = turn('Hello', second.state, 2, { carHireRequested: false });
    expect(third.state.carHireRequested).toBe(false);

    const fourth = turn('hire drive SUV', third.state, 3);
    expect(fourth.state.carHireRequested).toBe(false);
  });

  it('a later injected value replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { carHireRequested: false });
    expect(first.state.carHireRequested).toBe(false);

    const second = turn('change', first.state, 1, { carHireRequested: true });
    expect(second.state.carHireRequested).toBe(true);
  });

  it('message text alone never changes carHireRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = ['car', 'vehicle', 'rental', 'hire', 'drive', 'SUV'];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.carHireRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit car-hire-request cue in the message sets carHireRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I need car hire', initial, 0);
    expect(result.state.carHireRequested).toBe(true);
  });

  it('phase 8J clear car-hire cues set carHireRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const rentalCar = turn('rental car', initial, 0);
    expect(rentalCar.state.carHireRequested).toBe(true);
    expect(rentalCar.state.flightsRequested).toBeNull();
    expect(rentalCar.state.accommodationRequested).toBeNull();

    const vehicleHire = turn('vehicle hire', initial, 1);
    expect(vehicleHire.state.carHireRequested).toBe(true);

    const options = turn('car hire options', initial, 2);
    expect(options.state.carHireRequested).toBe(true);

    const inRequest = turn(
      'I need car hire. Fly from Sydney to Brisbane',
      initial,
      3,
    );
    expect(inRequest.state.carHireRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 4, {
      carHireRequested: false,
    });
    const negated = turn('no car hire', seeded.state, 5);
    expect(negated.state.carHireRequested).toBe(false);
    const personalCar = turn('my car', seeded.state, 6);
    expect(personalCar.state.carHireRequested).toBe(false);
    const alreadyBooked = turn('I have a rental car', seeded.state, 7);
    expect(alreadyBooked.state.carHireRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.carHireRequested overrides an extracted car-hire request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('book car hire', initial, 0, {
      carHireRequested: false,
    });
    expect(overriddenFalse.state.carHireRequested).toBe(false);

    const overriddenTrue = turn('no car hire', initial, 1, {
      carHireRequested: true,
    });
    expect(overriddenTrue.state.carHireRequested).toBe(true);

    const nullOverride = turn('book car hire', initial, 2, {
      carHireRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.carHireRequested).toBeNull();
  });

  it('flightsRequested, accommodationRequested and earlier fields remain preserved', () => {
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
    });
    expect(first.state.carHireRequested).toBe(true);
    expect(first.state.flightsRequested).toBe(true);
    expect(first.state.accommodationRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.adultCount).toBe(2);
    expect(first.state.childCount).toBe(1);
    expect(first.state.infantCount).toBe(1);

    const second = turn('no car', first.state, 1, {
      carHireRequested: false,
    });
    expect(second.state.carHireRequested).toBe(false);
    expect(second.state.flightsRequested).toBe(true);
    expect(second.state.accommodationRequested).toBe(true);
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
