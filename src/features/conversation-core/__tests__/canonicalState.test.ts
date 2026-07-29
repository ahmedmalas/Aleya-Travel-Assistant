import { describe, expect, it, vi } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
} from '../index';

const NOW = new Date('2026-07-28T12:00:00.000Z');
const CONVERSATION_ID = 'conversation-core-test-001';
const ENTRY_ID = 'entry-test-001';

const CANONICAL_KEYS = [
  'conversationId',
  'createdAt',
  'status',
  'transcript',
  'turnCount',
  'updatedAt',
] as const;

const FORBIDDEN_STATE_FIELDS = [
  'origin',
  'destination',
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

  it('uses the same supplied instant for createdAt and updatedAt', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(state.createdAt).toBe(state.updatedAt);
    expect(state.createdAt).toBe(NOW.toISOString());
  });

  it('initial status is exactly empty and turnCount is 0', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(state.status).toBe('empty');
    expect(state.turnCount).toBe(0);
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
    processConversationTurn({
      message: 'Hello',
      state: createInitialConversationCoreState({
        conversationId: CONVERSATION_ID,
        now: NOW,
      }),
      now: NOW,
      entryId: ENTRY_ID,
    });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('processConversationTurn placeholder behaviour', () => {
  it('does not mutate the supplied state object', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const result = processConversationTurn({
      message: 'I want to visit Melbourne',
      state: initial,
      now: NOW,
      entryId: ENTRY_ID,
    });
    expect(result.state).not.toBe(initial);
    expect(initial.transcript).toEqual([]);
    expect(result.state.transcript).toHaveLength(1);
    expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });

  it('does not increment turnCount and keeps status empty', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const result = processConversationTurn({
      message: 'Hello',
      state: initial,
      now: NOW,
      entryId: ENTRY_ID,
    });
    expect(result.state.turnCount).toBe(0);
    expect(result.state.status).toBe('empty');
    expect(initial.turnCount).toBe(0);
  });
});
