import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
} from '../index';

const NOW = new Date('2026-07-29T00:00:00.000Z');
const CONVERSATION_ID = 'conversation-core-transcript-001';

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

describe('phase 2A — user transcript recording only', () => {
  it('transcript starts empty', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(state.transcript).toEqual([]);
  });

  it('one message creates one user entry with exact message, id, and timestamp', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const result = processConversationTurn({
      message: 'Sydney to Gold Coast!!!!',
      state: initial,
      now: NOW,
      entryId: 'entry-exact-001',
    });

    expect(result.state.transcript).toHaveLength(1);
    expect(result.state.transcript[0]).toEqual({
      id: 'entry-exact-001',
      role: 'user',
      message: 'Sydney to Gold Coast!!!!',
      timestamp: '2026-07-29T00:00:00.000Z',
    });
    expect(Object.keys(result.state.transcript[0]!).sort()).toEqual([
      'id',
      'message',
      'role',
      'timestamp',
    ]);
  });

  it('stores required messages byte-for-byte', () => {
    const messages = [
      'Melbourne',
      'Sydney to Gold Coast!!!!',
      'I want flights',
      'Forget Brisbane',
    ] as const;

    let state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });

    messages.forEach((message, index) => {
      const instant = new Date(NOW.getTime() + index * 1000);
      const result = processConversationTurn({
        message,
        state,
        now: instant,
        entryId: `entry-${index}`,
      });
      state = result.state;
      expect(result.state.transcript[index]?.message).toBe(message);
      expect(result.state.transcript[index]?.role).toBe('user');
      expect(result.state.transcript[index]?.id).toBe(`entry-${index}`);
      expect(result.state.transcript[index]?.timestamp).toBe(instant.toISOString());
      expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
      expect(result.state.turnCount).toBe(0);
      expect(result.state.status).toBe('empty');
    });

    expect(state.transcript.map((entry) => entry.message)).toEqual([...messages]);
  });

  it('preserves transcript order across multiple turns', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const first = processConversationTurn({
      message: 'Melbourne',
      state: initial,
      now: NOW,
      entryId: 'a',
    });
    const second = processConversationTurn({
      message: 'I want flights',
      state: first.state,
      now: new Date('2026-07-29T00:00:01.000Z'),
      entryId: 'b',
    });
    expect(second.state.transcript.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(second.state.transcript.map((entry) => entry.message)).toEqual([
      'Melbourne',
      'I want flights',
    ]);
  });

  it('does not parse or attach travel intelligence to entries', () => {
    const result = processConversationTurn({
      message: 'Forget Brisbane',
      conversationId: CONVERSATION_ID,
      now: NOW,
      entryId: 'entry-neg',
    });
    const entry = result.state.transcript[0]!;
    for (const key of FORBIDDEN_ENTRY_KEYS) {
      expect(Object.hasOwn(entry, key), key).toBe(false);
    }
    expect(result.trace.messageInterpreted).toBe(false);
    expect(result.trace.userMessageRecorded).toBe(true);
    expect(result.trace.persistenceUsed).toBe(false);
  });

  it('does not trim, lowercase, or rewrite the message', () => {
    const raw = '  Sydney to Gold Coast!!!!  ';
    const result = processConversationTurn({
      message: raw,
      conversationId: CONVERSATION_ID,
      now: NOW,
      entryId: 'entry-raw-space',
    });
    expect(result.state.transcript[0]?.message).toBe(raw);
    expect(result.state.transcript[0]?.message).not.toBe(raw.trim());
    expect(result.state.transcript[0]?.message).not.toBe(raw.toLowerCase());
  });

  it('does not record an assistant transcript entry', () => {
    const result = processConversationTurn({
      message: 'Melbourne',
      conversationId: CONVERSATION_ID,
      now: NOW,
      entryId: 'entry-user-only',
    });
    expect(result.state.transcript.every((entry) => entry.role === 'user')).toBe(true);
    expect(result.state.transcript.some((entry) => (entry as { role: string }).role === 'assistant')).toBe(
      false,
    );
  });
});
