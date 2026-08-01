import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-child-count-001';
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

describe('phase 3F — explicit childCount only', () => {
  it('initial childCount is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.childCount).toBeNull();
  });

  it('injected childCount is stored exactly', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('1 child please', initial, 0, { childCount: 1 });
    expect(result.state.childCount).toBe(1);

    const odd = turn('weird count', result.state, 1, { childCount: -2.25 });
    expect(odd.state.childCount).toBe(-2.25);
  });

  it('omitting childCount preserves the existing value when the message is unsupported', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { childCount: 1 });
    expect(first.state.childCount).toBe(1);

    const second = turn('child travellers', first.state, 1);
    expect(second.state.childCount).toBe(1);
  });

  it('a later injected childCount replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { childCount: 1 });
    expect(first.state.childCount).toBe(1);

    const second = turn('change children', first.state, 1, { childCount: 3 });
    expect(second.state.childCount).toBe(3);
  });

  it('unsupported child-traveller wording in the user message alone never changes childCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'kids: 3',
      'child travellers',
      'our two kids',
      'a 12-year-old',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.childCount).toBeNull();
      state = result.state;
    });
  });

  it('explicit child-count cue in the message updates childCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('2 children', initial, 0);
    expect(result.state.childCount).toBe(2);
  });

  it('phase 8F clear child cues update childCount without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const written = turn('two children', initial, 0);
    expect(written.state.childCount).toBe(2);
    expect(written.state.adultCount).toBeNull();
    expect(written.state.infantCount).toBeNull();

    // Phase 19K — without flights/accommodation context, combined sentences
    // do not partially update childCount.
    const mixed = turn('2 adults and 2 children', initial, 1);
    expect(mixed.state.childCount).toBeNull();
    expect(mixed.state.adultCount).toBeNull();

    // Service gate is read from currentState at extraction time; seed flights
    // first so the same-turn trusted stateUpdate cannot bypass the Multi gate.
    const flightsSeeded = turn('Hello', initial, 2, { flightsRequested: true });
    const mixedInContext = turn(
      '2 adults and 2 children',
      flightsSeeded.state,
      3,
    );
    expect(mixedInContext.state.childCount).toBe(2);
    expect(mixedInContext.state.adultCount).toBe(2);

    const inRequest = turn(
      'Fly from Sydney to Brisbane for two children',
      initial,
      4,
    );
    expect(inRequest.state.childCount).toBe(2);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 5, { childCount: 1, adultCount: 2 });
    const adultOnly = turn('2 adults', seeded.state, 6);
    expect(adultOnly.state.childCount).toBe(1);
    expect(adultOnly.state.adultCount).toBe(2);
    const infantOnly = turn('1 infant', seeded.state, 7);
    expect(infantOnly.state.childCount).toBe(1);
    const family = turn('our family', seeded.state, 8);
    expect(family.state.childCount).toBe(1);
    const zero = turn('0 children', seeded.state, 8);
    expect(zero.state.childCount).toBe(1);
  });

  it('trusted explicit stateUpdate.childCount overrides an extracted childCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overridden = turn('2 children', initial, 0, { childCount: 5 });
    expect(overridden.state.childCount).toBe(5);

    const nullOverride = turn('2 children', initial, 1, {
      childCount: null as unknown as number,
    });
    expect(nullOverride.state.childCount).toBeNull();
  });

  it('adultCount and earlier travel fields remain preserved when childCount changes', () => {
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
    });
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.adultCount).toBe(2);
    expect(first.state.childCount).toBe(1);

    const second = turn('change children', first.state, 1, { childCount: 2 });
    expect(second.state.childCount).toBe(2);
    expect(second.state.adultCount).toBe(2);
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
      childCount: 1,
    });

    expect(first.state.childCount).toBe(1);
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
    expect(second.state.childCount).toBe(1);
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
