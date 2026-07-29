import { describe, expect, it, vi } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
} from '../index';

const NOW = new Date('2026-07-28T12:00:00.000Z');
const LATER = new Date('2026-07-28T12:00:01.000Z');
const CONVERSATION_ID = 'conversation-core-test-001';

const CANONICAL_KEYS = [
  'ageMs',
  'conversationId',
  'createdAt',
  'destination',
  'origin',
  'status',
  'transcript',
  'turnCount',
  'updatedAt',
] as const;

const FORBIDDEN_STATE_FIELDS = [
  'dates',
  'travellers',
  'services',
  'preferences',
  'accommodation',
  'discovery',
  'search',
  'phase',
  'pendingClarification',
  'lastOffer',
  'summary',
  'history',
  'messages',
  'schemaVersion',
  'migrationVersion',
  'namespace',
  'sessionId',
] as const;

function turn(
  message: string,
  state = createInitialConversationCoreState({
    conversationId: CONVERSATION_ID,
    now: NOW,
  }),
  ids = { user: 'user-1', assistant: 'assistant-1' },
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: ids.user,
    assistantEntryId: ids.assistant,
    userMessageAt: NOW,
    assistantMessageAt: LATER,
  });
}

describe('canonical conversation-core state', () => {
  it('returns the exact canonical shape with empty transcript', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });

    expect(Object.keys(state).sort()).toEqual([...CANONICAL_KEYS]);
    expect(state).toEqual({
      conversationId: CONVERSATION_ID,
      status: 'empty',
      turnCount: 0,
      createdAt: '2026-07-28T12:00:00.000Z',
      updatedAt: '2026-07-28T12:00:00.000Z',
      ageMs: 0,
      destination: null,
      origin: null,
      transcript: [],
    });
  });

  it('is deterministic for identical inputs', () => {
    const a = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const b = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(a).toEqual(b);
  });

  it('contains no rejected travel fields', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    for (const field of FORBIDDEN_STATE_FIELDS) {
      expect(Object.hasOwn(state, field), field).toBe(false);
    }
  });

  it('does not call persistence APIs', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    turn('Hello');
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('processConversationTurn placeholder behaviour', () => {
  it('does not mutate the supplied state object or transcript array', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const originalTranscript = initial.transcript;
    const result = turn('I want to visit Melbourne', initial);
    expect(result.state).not.toBe(initial);
    expect(result.state.transcript).not.toBe(originalTranscript);
    expect(initial.transcript).toEqual([]);
    expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });

  it('allows turnCount progression after a successful turn', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const result = turn('Hello', initial);
    expect(result.state.turnCount).toBe(1);
    expect(initial.turnCount).toBe(0);
  });
});
