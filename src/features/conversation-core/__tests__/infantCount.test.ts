import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-infant-count-001';
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

describe('phase 3G — explicit infantCount only', () => {
  it('initial infantCount is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.infantCount).toBeNull();
  });

  it('injected infantCount is stored exactly', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('1 infant please', initial, 0, { infantCount: 1 });
    expect(result.state.infantCount).toBe(1);

    const odd = turn('weird count', result.state, 1, { infantCount: -1.5 });
    expect(odd.state.infantCount).toBe(-1.5);
  });

  it('omitting infantCount preserves the existing value when the message is unsupported', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { infantCount: 1 });
    expect(first.state.infantCount).toBe(1);

    const second = turn('infant travellers', first.state, 1);
    expect(second.state.infantCount).toBe(1);
  });

  it('a later injected infantCount replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { infantCount: 1 });
    expect(first.state.infantCount).toBe(1);

    const second = turn('change infants', first.state, 1, { infantCount: 2 });
    expect(second.state.infantCount).toBe(2);
  });

  it('unsupported infant wording in the user message alone never changes infantCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'babies: 3',
      'infant travellers',
      'travelling with a baby',
      'a six-month-old baby',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.infantCount).toBeNull();
      state = result.state;
    });
  });

  it('explicit infant-count cue in the message updates infantCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('1 infant', initial, 0);
    expect(result.state.infantCount).toBe(1);
  });

  it('phase 8G clear infant cues update infantCount without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const written = turn('one infant', initial, 0);
    expect(written.state.infantCount).toBe(1);
    expect(written.state.adultCount).toBeNull();
    expect(written.state.childCount).toBeNull();

    // Phase 19K — without flights/accommodation context, combined sentences
    // do not partially update infantCount via single-category ownership.
    const mixed = turn('2 adults, 1 child and 1 infant', initial, 1);
    expect(mixed.state.infantCount).toBeNull();
    expect(mixed.state.childCount).toBeNull();
    expect(mixed.state.adultCount).toBeNull();

    // Service gate is read from currentState at extraction time.
    const flightsSeeded = turn('Hello', initial, 2, { flightsRequested: true });
    const mixedInContext = turn(
      '2 adults, 1 child and 1 infant',
      flightsSeeded.state,
      3,
    );
    expect(mixedInContext.state.infantCount).toBe(1);
    expect(mixedInContext.state.childCount).toBe(1);
    expect(mixedInContext.state.adultCount).toBe(2);

    const inRequest = turn(
      'Fly from Sydney to Brisbane for one infant',
      initial,
      4,
    );
    expect(inRequest.state.infantCount).toBe(1);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 5, {
      infantCount: 1,
      adultCount: 2,
      childCount: 1,
    });
    const adultOnly = turn('2 adults', seeded.state, 6);
    expect(adultOnly.state.infantCount).toBe(1);
    const childOnly = turn('1 child', seeded.state, 7);
    expect(childOnly.state.infantCount).toBe(1);
    const baby = turn('our baby', seeded.state, 8);
    expect(baby.state.infantCount).toBe(1);
    // Phase 19L — explicit zero updates infantCount.
    const zero = turn('0 infants', seeded.state, 9);
    expect(zero.state.infantCount).toBe(0);
  });

  it('trusted explicit stateUpdate.infantCount overrides an extracted infantCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overridden = turn('1 infant', initial, 0, { infantCount: 3 });
    expect(overridden.state.infantCount).toBe(3);

    const nullOverride = turn('1 infant', initial, 1, {
      infantCount: null as unknown as number,
    });
    expect(nullOverride.state.infantCount).toBeNull();
  });

  it('adultCount, childCount and earlier fields remain preserved when infantCount changes', () => {
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
    });
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.adultCount).toBe(2);
    expect(first.state.childCount).toBe(1);
    expect(first.state.infantCount).toBe(1);

    const second = turn('change infants', first.state, 1, { infantCount: 2 });
    expect(second.state.infantCount).toBe(2);
    expect(second.state.adultCount).toBe(2);
    expect(second.state.childCount).toBe(1);
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
      infantCount: 1,
    });

    expect(first.state.infantCount).toBe(1);
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
    expect(second.state.infantCount).toBe(1);
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
