import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-origin-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  fields: { origin?: string; destination?: string } = {},
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

describe('phase 3B — explicit origin only', () => {
  it('initial origin is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.origin).toBeNull();
  });

  it('injected origin is stored byte-for-byte', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const raw = '  Sydney!!!!  ';
    const result = turn('from Melbourne', initial, 0, { origin: raw });
    expect(result.state.origin).toBe(raw);
    expect(result.state.origin).toBe('  Sydney!!!!  ');
  });

  it('omitting origin preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { origin: 'Sydney' });
    expect(first.state.origin).toBe('Sydney');

    const second = turn('leaving Melbourne', first.state, 1);
    expect(second.state.origin).toBe('Sydney');
  });

  it('a later injected origin replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { origin: 'Sydney' });
    expect(first.state.origin).toBe('Sydney');

    const second = turn('change origin', first.state, 1, { origin: 'Melbourne' });
    expect(second.state.origin).toBe('Melbourne');
  });

  it('user message text alone never changes origin', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'from Sydney',
      'leaving Melbourne',
      'departing Brisbane',
      'flying out of Perth',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.origin).toBeNull();
      state = result.state;
    });
  });

  it('destination remains preserved when origin changes', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      destination: 'Gold Coast',
      origin: 'Sydney',
    });
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.origin).toBe('Sydney');

    const second = turn('leaving Melbourne', first.state, 1, {
      origin: 'Melbourne',
    });
    expect(second.state.origin).toBe('Melbourne');
    expect(second.state.destination).toBe('Gold Coast');
  });

  it('preserves transcript, status, turn count, timestamps and placeholder reply', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0, {
      origin: 'Sydney',
      destination: 'Gold Coast',
    });

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
