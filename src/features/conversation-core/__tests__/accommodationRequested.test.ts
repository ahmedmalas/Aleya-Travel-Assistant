import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-accommodation-requested-001';
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
    ...(fields.accommodationRequested !== undefined
      ? { accommodationRequested: fields.accommodationRequested }
      : {}),
  });
}

describe('phase 3I — explicit accommodationRequested only', () => {
  it('initial accommodationRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.accommodationRequested).toBeNull();
  });

  it('injected true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want a hotel', initial, 0, {
      accommodationRequested: true,
    });
    expect(result.state.accommodationRequested).toBe(true);
  });

  it('injected false is stored and not treated as omitted', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need a stay', initial, 0, {
      accommodationRequested: true,
    });
    expect(withTrue.state.accommodationRequested).toBe(true);

    const withFalse = turn('no hotel', withTrue.state, 1, {
      accommodationRequested: false,
    });
    expect(withFalse.state.accommodationRequested).toBe(false);
    expect(withFalse.state.accommodationRequested).not.toBeNull();
  });

  it('omitting accommodationRequested preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      accommodationRequested: true,
    });
    expect(first.state.accommodationRequested).toBe(true);

    const second = turn('hotel room resort', first.state, 1);
    expect(second.state.accommodationRequested).toBe(true);

    const third = turn('Hello', second.state, 2, {
      accommodationRequested: false,
    });
    expect(third.state.accommodationRequested).toBe(false);

    const fourth = turn('apartment accommodation', third.state, 3);
    expect(fourth.state.accommodationRequested).toBe(false);
  });

  it('a later injected value replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      accommodationRequested: false,
    });
    expect(first.state.accommodationRequested).toBe(false);

    const second = turn('change', first.state, 1, {
      accommodationRequested: true,
    });
    expect(second.state.accommodationRequested).toBe(true);
  });

  it('message text alone never changes accommodationRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'hotel',
      'stay',
      'room',
      'resort',
      'accommodation',
      'apartment',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.accommodationRequested).toBeNull();
      state = result.state;
    });
  });

  it('flightsRequested and earlier fields remain preserved when accommodationRequested changes', () => {
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
    });
    expect(first.state.accommodationRequested).toBe(true);
    expect(first.state.flightsRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.adultCount).toBe(2);
    expect(first.state.childCount).toBe(1);
    expect(first.state.infantCount).toBe(1);

    const second = turn('no hotel', first.state, 1, {
      accommodationRequested: false,
    });
    expect(second.state.accommodationRequested).toBe(false);
    expect(second.state.flightsRequested).toBe(true);
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
