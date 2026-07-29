import { describe, expect, it, vi } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
} from '../index';

const NOW = new Date('2026-07-28T12:00:00.000Z');
const CONVERSATION_ID = 'conversation-core-test-001';

const CANONICAL_KEYS = [
  'conversationId',
  'createdAt',
  'status',
  'turnCount',
  'updatedAt',
] as const;

const FORBIDDEN_FIELDS = [
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
  'transcript',
  'messages',
  'schemaVersion',
  'migrationVersion',
  'namespace',
  'sessionId',
] as const;

describe('canonical conversation-core state', () => {
  it('returns the exact canonical shape', () => {
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

  it('initial status is exactly empty', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(state.status).toBe('empty');
  });

  it('initial turn count is exactly 0', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(state.turnCount).toBe(0);
  });

  it('contains no rejected travel fields', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    for (const field of FORBIDDEN_FIELDS) {
      expect(Object.hasOwn(state, field), field).toBe(false);
    }
  });

  it('contains no schemaVersion or migration field', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(Object.hasOwn(state, 'schemaVersion')).toBe(false);
    expect(Object.hasOwn(state, 'migrationVersion')).toBe(false);
  });

  it('does not call persistence APIs', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('processConversationTurn with canonical empty state', () => {
  it('does not mutate supplied state and returns the placeholder', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const frozen = Object.freeze({ ...initial });
    const result = processConversationTurn({
      message: 'I want to visit Melbourne',
      state: frozen,
    });
    expect(result.state).toEqual(initial);
    expect(result.state).toBe(frozen);
    expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });

  it('does not increment turnCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    const result = processConversationTurn({
      message: 'Hello',
      state: initial,
    });
    expect(result.state.turnCount).toBe(0);
    expect(initial.turnCount).toBe(0);
  });

  it('arbitrary travel messages do not change state', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    for (const message of [
      'Hello',
      'Melbourne',
      'I want to go somewhere tropical',
      'Sydney to Gold Coast',
      '28 August 2026',
      'Flights and accommodation',
      'Forget Melbourne',
      'Start searching',
    ]) {
      const result = processConversationTurn({ message, state: initial });
      expect(result.state).toEqual(initial);
      expect(result.state.status).toBe('empty');
      expect(result.state.turnCount).toBe(0);
      expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
      expect(result.trace).toEqual({
        entryPoint: 'processConversationTurn',
        stateStatus: 'empty',
        turnCount: 0,
        stateChanged: false,
        messageInterpreted: false,
        persistenceUsed: false,
      });
    }
  });

  it('does not write localStorage', () => {
    localStorage.clear();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    processConversationTurn({
      message: 'Sydney to Melbourne',
      conversationId: CONVERSATION_ID,
      now: NOW,
    });
    expect(localStorage.length).toBe(0);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
