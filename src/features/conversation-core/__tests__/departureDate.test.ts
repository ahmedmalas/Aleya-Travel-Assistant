import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-departure-date-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  fields: {
    origin?: string;
    destination?: string;
    departureDate?: string;
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

describe('phase 3C — explicit departureDate only', () => {
  it('initial departureDate is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.departureDate).toBeNull();
  });

  it('injected departureDate is stored byte-for-byte', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const raw = '  15/08/2026!!!!  ';
    const result = turn('leaving next Friday', initial, 0, {
      departureDate: raw,
    });
    expect(result.state.departureDate).toBe(raw);
    expect(result.state.departureDate).toBe('  15/08/2026!!!!  ');
  });

  it('omitting departureDate preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { departureDate: '2026-08-15' });
    expect(first.state.departureDate).toBe('2026-08-15');

    const second = turn('departing next Monday', first.state, 1);
    expect(second.state.departureDate).toBe('2026-08-15');
  });

  it('a later injected departureDate replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { departureDate: '2026-08-15' });
    expect(first.state.departureDate).toBe('2026-08-15');

    const second = turn('change date', first.state, 1, {
      departureDate: '2026-09-01',
    });
    expect(second.state.departureDate).toBe('2026-09-01');
  });

  it('unsupported date wording in the user message alone never changes departureDate', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'leaving next Friday',
      'departing on 15 August',
      'fly out tomorrow',
      '2026-08-15',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.departureDate).toBeNull();
      state = result.state;
    });
  });

  it('explicit departure-date cue in the message updates departureDate', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('Depart on 28 August 2026', initial, 0);
    expect(result.state.departureDate).toBe('2026-08-28');
  });

  it('trusted explicit stateUpdate.departureDate overrides an extracted departureDate', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overridden = turn('Depart on 28 August 2026', initial, 0, {
      departureDate: '2026-11-01',
    });
    expect(overridden.state.departureDate).toBe('2026-11-01');

    const nullOverride = turn('Depart on 28 August 2026', initial, 1, {
      departureDate: null as unknown as string,
    });
    expect(nullOverride.state.departureDate).toBeNull();
  });

  it('origin and destination remain preserved when departureDate changes', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      origin: 'Sydney',
      destination: 'Gold Coast',
      departureDate: '2026-08-15',
    });
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');

    const second = turn('change date', first.state, 1, {
      departureDate: '2026-09-01',
    });
    expect(second.state.departureDate).toBe('2026-09-01');
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.destination).toBe('Gold Coast');
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
    });

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
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('Sydney to Gold Coast!!!!', first.state, 1);
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
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
