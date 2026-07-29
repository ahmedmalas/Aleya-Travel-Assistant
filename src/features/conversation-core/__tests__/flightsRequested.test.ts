import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
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
    ...(fields.origin !== undefined ? { origin: fields.origin } : {}),
    ...(fields.destination !== undefined
      ? { destination: fields.destination }
      : {}),
    ...(fields.departureDate !== undefined
      ? { departureDate: fields.departureDate }
      : {}),
    ...(fields.returnDate !== undefined
      ? { returnDate: fields.returnDate }
      : {}),
    ...(fields.adultCount !== undefined
      ? { adultCount: fields.adultCount }
      : {}),
    ...(fields.childCount !== undefined
      ? { childCount: fields.childCount }
      : {}),
    ...(fields.infantCount !== undefined
      ? { infantCount: fields.infantCount }
      : {}),
    ...(fields.flightsRequested !== undefined
      ? { flightsRequested: fields.flightsRequested }
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

  it('message text alone never changes flightsRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'flight',
      'fly',
      'airline',
      'plane',
      'Qantas',
      'Virgin',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.flightsRequested).toBeNull();
      state = result.state;
    });
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
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
