import { describe, expect, it, vi } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const USER_AT = new Date('2026-07-29T00:00:00.000Z');
const ASSISTANT_AT = new Date('2026-07-29T00:00:01.000Z');
const CONVERSATION_ID = 'conversation-core-assistant-001';

const FORBIDDEN_ENTRY_KEYS = [
  'destination',
  'origin',
  'service',
  'travellers',
  'requirements',
  'intent',
  'entities',
  'summary',
  'analysis',
] as const;

const ACCEPTANCE_MESSAGES = [
  'Hello',
  'Melbourne',
  'Sydney to Gold Coast!!!!',
  'I want flights',
  'Forget Brisbane',
  'Start searching',
] as const;

function turn(
  message: string,
  state: ConversationCoreState,
  ids: { user: string; assistant: string },
  times: { user: Date; assistant: Date } = { user: USER_AT, assistant: ASSISTANT_AT },
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: ids.user,
    assistantEntryId: ids.assistant,
    userMessageAt: times.user,
    assistantMessageAt: times.assistant,
  });
}

describe('phase 2B — assistant placeholder transcript recording', () => {
  it('one turn appends exactly two entries in user-then-assistant order', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const result = turn('Melbourne', initial, {
      user: 'user-1',
      assistant: 'assistant-1',
    });

    expect(result.state.transcript).toHaveLength(2);
    expect(result.state.transcript[0]?.role).toBe('user');
    expect(result.state.transcript[1]?.role).toBe('assistant');
    expect(result.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
  });

  it('stores user message byte-for-byte and assistant placeholder from the shared constant', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const result = turn('Sydney to Gold Coast!!!!', initial, {
      user: 'user-1',
      assistant: 'assistant-1',
    });

    expect(result.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(result.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(result.reply).toBe(result.state.transcript[1]?.message);
  });

  it('preserves injected IDs and timestamps', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const result = turn('Hello', initial, {
      user: 'injected-user',
      assistant: 'injected-assistant',
    });

    expect(result.state.transcript[0]).toEqual({
      id: 'injected-user',
      role: 'user',
      message: 'Hello',
      timestamp: '2026-07-29T00:00:00.000Z',
    });
    expect(result.state.transcript[1]).toEqual({
      id: 'injected-assistant',
      role: 'assistant',
      message: ENGINE_NOT_ASSEMBLED_REPLY,
      timestamp: '2026-07-29T00:00:01.000Z',
    });
  });

  it('appends without altering prior transcript entries or deduplicating repeats', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const first = turn('Melbourne', initial, {
      user: 'u1',
      assistant: 'a1',
    });
    const prior = first.state.transcript.map((entry) => ({ ...entry }));
    const second = turn(
      'Melbourne',
      first.state,
      { user: 'u2', assistant: 'a2' },
      {
        user: new Date('2026-07-29T00:00:02.000Z'),
        assistant: new Date('2026-07-29T00:00:03.000Z'),
      },
    );

    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript.slice(0, 2)).toEqual(prior);
    expect(second.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(second.state.transcript[0]?.message).toBe('Melbourne');
    expect(second.state.transcript[2]?.message).toBe('Melbourne');
  });

  it('does not mutate supplied state or transcript array', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const seeded = turn('Hello', initial, { user: 'u0', assistant: 'a0' }).state;
    const suppliedTranscript = seeded.transcript;
    const snapshot = seeded.transcript.map((entry) => ({ ...entry }));

    const result = turn('Melbourne', seeded, { user: 'u1', assistant: 'a1' });

    expect(result.state).not.toBe(seeded);
    expect(result.state.transcript).not.toBe(suppliedTranscript);
    expect(seeded.transcript).toEqual(snapshot);
    expect(suppliedTranscript).toEqual(snapshot);
  });

  it('keeps conversationId and createdAt unchanged', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const result = turn('I want flights', initial, {
      user: 'u1',
      assistant: 'a1',
    });

    expect(result.state.conversationId).toBe(initial.conversationId);
    expect(result.state.createdAt).toBe(initial.createdAt);
  });

  it('adds no travel fields on entries and calls no persistence APIs', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const result = turn('Forget Brisbane', initial, {
      user: 'u1',
      assistant: 'a1',
    });

    for (const entry of result.state.transcript) {
      expect(Object.keys(entry).sort()).toEqual(['id', 'message', 'role', 'timestamp']);
      for (const key of FORBIDDEN_ENTRY_KEYS) {
        expect(Object.hasOwn(entry, key), key).toBe(false);
      }
    }
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('acceptance scenarios each produce one user entry then one placeholder assistant entry', () => {
    for (const message of ACCEPTANCE_MESSAGES) {
      const initial = createInitialConversationCoreState({
        conversationId: CONVERSATION_ID,
        now: USER_AT,
      });
      const result = turn(message, initial, {
        user: `user-${message}`,
        assistant: `assistant-${message}`,
      });

      expect(result.state.transcript).toHaveLength(2);
      expect(result.state.transcript[0]?.role).toBe('user');
      expect(result.state.transcript[0]?.message).toBe(message);
      expect(result.state.transcript[1]?.role).toBe('assistant');
      expect(result.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
      expect(result.reply).toBe(result.state.transcript[1]?.message);
      expect(result.state.turnCount).toBe(1);
      expect(result.trace.messageInterpreted).toBe(false);
      expect(result.trace.assistantMessageRecorded).toBe(true);
    }
  });

  it('two sequential calls yield user assistant user assistant roles', () => {
    let state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    state = turn('Hello', state, { user: 'u1', assistant: 'a1' }).state;
    state = turn(
      'Melbourne',
      state,
      { user: 'u2', assistant: 'a2' },
      {
        user: new Date('2026-07-29T00:00:02.000Z'),
        assistant: new Date('2026-07-29T00:00:03.000Z'),
      },
    ).state;

    expect(state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
  });
});
