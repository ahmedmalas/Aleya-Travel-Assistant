import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-flights-requested-001';
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

describe('phase 3H — explicit flightsRequested only', () => {
  it('initial flightsRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.flightsRequested).toBeNull();
  });

  it('injected true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want a flight', initial, 0, {
      flightsRequested: true,
    });
    expect(result.state.flightsRequested).toBe(true);
  });

  it('injected false is stored and not treated as omitted', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need flights', initial, 0, {
      flightsRequested: true,
    });
    expect(withTrue.state.flightsRequested).toBe(true);

    const withFalse = turn('no flights', withTrue.state, 1, {
      flightsRequested: false,
    });
    expect(withFalse.state.flightsRequested).toBe(false);
    expect(withFalse.state.flightsRequested).not.toBeNull();
  });

  it('omitting flightsRequested preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { flightsRequested: true });
    expect(first.state.flightsRequested).toBe(true);

    const second = turn('fly with Qantas', first.state, 1);
    expect(second.state.flightsRequested).toBe(true);

    const third = turn('Hello', second.state, 2, { flightsRequested: false });
    expect(third.state.flightsRequested).toBe(false);

    const fourth = turn('airline plane Virgin', third.state, 3);
    expect(fourth.state.flightsRequested).toBe(false);
  });

  it('a later injected value replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { flightsRequested: false });
    expect(first.state.flightsRequested).toBe(false);

    const second = turn('change', first.state, 1, { flightsRequested: true });
    expect(second.state.flightsRequested).toBe(true);
  });

  it('unsupported flight wording in the user message alone never changes flightsRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'fly',
      'airline',
      'plane',
      'Qantas',
      'Virgin',
      'flight delayed',
      'flying from Sydney',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.flightsRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit flights-request cue in the message sets flightsRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I need flights', initial, 0);
    expect(result.state.flightsRequested).toBe(true);
  });

  it('phase 8H clear flight cues set flightsRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const singular = turn('flight', initial, 0);
    expect(singular.state.flightsRequested).toBe(true);

    const airfare = turn('airfare', initial, 1);
    expect(airfare.state.flightsRequested).toBe(true);

    const planeTickets = turn('plane tickets', initial, 2);
    expect(planeTickets.state.flightsRequested).toBe(true);

    const inRequest = turn(
      'I need flights. Fly from Sydney to Brisbane',
      initial,
      3,
    );
    expect(inRequest.state.flightsRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 4, { flightsRequested: false });
    const negated = turn('no flights', seeded.state, 5);
    expect(negated.state.flightsRequested).toBe(false);
    const status = turn('flight status', seeded.state, 6);
    expect(status.state.flightsRequested).toBe(false);
    const provider = turn('Qantas', seeded.state, 7);
    expect(provider.state.flightsRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.flightsRequested overrides an extracted flights request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('book flights', initial, 0, {
      flightsRequested: false,
    });
    expect(overriddenFalse.state.flightsRequested).toBe(false);

    const overriddenTrue = turn('no flights', initial, 1, {
      flightsRequested: true,
    });
    expect(overriddenTrue.state.flightsRequested).toBe(true);

    const nullOverride = turn('book flights', initial, 2, {
      flightsRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.flightsRequested).toBeNull();
  });

  it('all earlier fields remain preserved when flightsRequested changes', () => {
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
    });
    expect(first.state.flightsRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.adultCount).toBe(2);
    expect(first.state.childCount).toBe(1);
    expect(first.state.infantCount).toBe(1);

    const second = turn('no flights', first.state, 1, {
      flightsRequested: false,
    });
    expect(second.state.flightsRequested).toBe(false);
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
