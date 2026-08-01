import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-adult-count-001';
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

describe('phase 3E — explicit adultCount only', () => {
  it('initial adultCount is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.adultCount).toBeNull();
  });

  it('injected adultCount is stored exactly', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('2 adults please', initial, 0, { adultCount: 2 });
    expect(result.state.adultCount).toBe(2);

    const odd = turn('weird count', result.state, 1, { adultCount: -3.5 });
    expect(odd.state.adultCount).toBe(-3.5);
  });

  it('omitting adultCount preserves the existing value when the message is unsupported', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { adultCount: 2 });
    expect(first.state.adultCount).toBe(2);

    const second = turn('three travellers', first.state, 1);
    expect(second.state.adultCount).toBe(2);
  });

  it('a later injected adultCount replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { adultCount: 2 });
    expect(first.state.adultCount).toBe(2);

    const second = turn('change adults', first.state, 1, { adultCount: 4 });
    expect(second.state.adultCount).toBe(4);
  });

  it('unsupported traveller wording in the user message alone never changes adultCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'three travellers',
      'adults: 5',
      'party of 4',
      'just me',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.adultCount).toBeNull();
      state = result.state;
    });
  });

  it('explicit adult-count cue in the message updates adultCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('2 adults', initial, 0);
    expect(result.state.adultCount).toBe(2);
  });

  it('phase 8E clear adult cues update adultCount without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const written = turn('two adults', initial, 0);
    expect(written.state.adultCount).toBe(2);
    expect(written.state.childCount).toBeNull();
    expect(written.state.infantCount).toBeNull();

    const inRequest = turn(
      '2 adults flying from Sydney to Brisbane',
      initial,
      1,
    );
    expect(inRequest.state.adultCount).toBe(2);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const grown = turn('2 grown adults', initial, 2);
    expect(grown.state.adultCount).toBe(2);

    const travellers = turn('two adult travellers', initial, 3);
    expect(travellers.state.adultCount).toBe(2);

    const seeded = turn('Hello', initial, 4, { adultCount: 3 });
    const childOnly = turn('2 children', seeded.state, 5);
    expect(childOnly.state.adultCount).toBe(3);
    const people = turn('two people', seeded.state, 6);
    expect(people.state.adultCount).toBe(3);
    const relationship = turn('me and my wife', seeded.state, 7);
    expect(relationship.state.adultCount).toBe(3);
    const zero = turn('0 adults', seeded.state, 8);
    expect(zero.state.adultCount).toBe(3);
  });

  it('trusted explicit stateUpdate.adultCount overrides an extracted adultCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overridden = turn('2 adults', initial, 0, { adultCount: 5 });
    expect(overridden.state.adultCount).toBe(5);

    const nullOverride = turn('2 adults', initial, 1, {
      adultCount: null as unknown as number,
    });
    expect(nullOverride.state.adultCount).toBeNull();
  });

  it('origin, destination and dates remain preserved when adultCount changes', () => {
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
    });
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.adultCount).toBe(2);

    const second = turn('change adults', first.state, 1, { adultCount: 3 });
    expect(second.state.adultCount).toBe(3);
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.destination).toBe('Gold Coast');
    expect(second.state.departureDate).toBe('2026-08-15');
    expect(second.state.returnDate).toBe('2026-08-22');
  });

  it('preserves transcript, status, turn count and timestamps', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0, {
      origin: 'Sydney',
      destination: 'Gold Coast',
      departureDate: '2026-08-15',
      returnDate: '2026-08-22',
      adultCount: 2,
    });

    expect(first.state.adultCount).toBe(2);
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);
    expect(first.state.ageMs).toBe(1000);
    expect(first.state.updatedAt).toBe('2026-07-29T00:00:01.000Z');
    expect(first.state.createdAt).toBe(initial.createdAt);
    expect(first.state.conversationId).toBe(CONVERSATION_ID);
    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(first.reply);
    expect(first.reply).toBe(first.state.transcript.at(-1)?.message);
    expect(first.reply).not.toMatch(/assembled|unavailable/i);

    const second = turn('Sydney to Gold Coast!!!!', first.state, 1);
    expect(second.state.adultCount).toBe(2);
    expect(second.state.returnDate).toBe('2026-08-22');
    expect(second.state.departureDate).toBe('2026-08-15');
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.destination).toBe('Gold Coast');
    expect(second.state.status).toBe('active');
    expect(second.state.turnCount).toBe(2);
    expect(second.state.ageMs).toBe(3000);
    expect(second.state.updatedAt).toBe('2026-07-29T00:00:03.000Z');
    expect(second.state.createdAt).toBe(initial.createdAt);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript[0]).toEqual(first.state.transcript[0]);
    expect(second.reply).toBe(second.state.transcript.at(-1)?.message);
    expect(second.reply).not.toMatch(/assembled|unavailable/i);
  });
});
