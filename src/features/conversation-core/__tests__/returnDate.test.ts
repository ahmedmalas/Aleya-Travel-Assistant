import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-return-date-001';
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

describe('phase 3D — explicit returnDate only', () => {
  it('initial returnDate is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.returnDate).toBeNull();
  });

  it('injected returnDate is stored byte-for-byte', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const raw = '  22/08/2026!!!!  ';
    const result = turn('returning next Sunday', initial, 0, {
      returnDate: raw,
    });
    expect(result.state.returnDate).toBe(raw);
    expect(result.state.returnDate).toBe('  22/08/2026!!!!  ');
  });

  it('omitting returnDate preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { returnDate: '2026-08-22' });
    expect(first.state.returnDate).toBe('2026-08-22');

    const second = turn('coming back next Monday', first.state, 1);
    expect(second.state.returnDate).toBe('2026-08-22');
  });

  it('a later injected returnDate replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { returnDate: '2026-08-22' });
    expect(first.state.returnDate).toBe('2026-08-22');

    const second = turn('change return', first.state, 1, {
      returnDate: '2026-09-10',
    });
    expect(second.state.returnDate).toBe('2026-09-10');
  });

  it('unsupported return-date wording in the user message alone never changes returnDate', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'returning next Sunday',
      'coming back on 22 August',
      'return tomorrow',
      '2026-08-22',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.returnDate).toBeNull();
      state = result.state;
    });
  });

  it('explicit return-date cue in the message updates returnDate', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('Return on 31 August 2026', initial, 0);
    expect(result.state.returnDate).toBe('2026-08-31');
  });

  it('phase 8D clear return cues and combined wording update returnDate only', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const until = turn('until 31 August 2026', initial, 0);
    expect(until.state.returnDate).toBe('2026-08-31');
    expect(until.state.departureDate).toBeNull();

    const backOn = turn('back on 31 August 2026', initial, 1);
    expect(backOn.state.returnDate).toBe('2026-08-31');

    const combined = turn(
      'departing 28 August 2026 and returning 31 August 2026',
      initial,
      2,
    );
    expect(combined.state.returnDate).toBe('2026-08-31');
    expect(combined.state.departureDate).toBeNull();

    const seeded = turn('Hello', initial, 3, {
      returnDate: '2026-09-08',
      departureDate: '2026-09-01',
    });
    const departureOnly = turn('departing 28 August 2026', seeded.state, 4);
    expect(departureOnly.state.returnDate).toBe('2026-09-08');
    expect(departureOnly.state.departureDate).toBe('2026-08-28');

    const ambiguous = turn('sometime in August', seeded.state, 5);
    expect(ambiguous.state.returnDate).toBe('2026-09-08');
  });

  it('trusted explicit stateUpdate.returnDate overrides an extracted returnDate', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overridden = turn('Return on 31 August 2026', initial, 0, {
      returnDate: '2026-11-12',
    });
    expect(overridden.state.returnDate).toBe('2026-11-12');

    const nullOverride = turn('Return on 31 August 2026', initial, 1, {
      returnDate: null as unknown as string,
    });
    expect(nullOverride.state.returnDate).toBeNull();
  });

  it('origin, destination and departureDate remain preserved when returnDate changes', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      origin: 'Sydney',
      destination: 'Gold Coast',
      departureDate: '2026-08-15',
      returnDate: '2026-08-22',
    });
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');

    const second = turn('change return', first.state, 1, {
      returnDate: '2026-09-10',
    });
    expect(second.state.returnDate).toBe('2026-09-10');
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.destination).toBe('Gold Coast');
    expect(second.state.departureDate).toBe('2026-08-15');
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
    });

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
