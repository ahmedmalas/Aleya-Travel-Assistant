import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_CORE_STORAGE_NAMESPACE,
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
} from '../index';

describe('conversation-core empty boundary', () => {
  it('creates initial state under the first-principles namespace', () => {
    const state = createInitialConversationCoreState(
      new Date('2026-07-28T00:00:00.000Z'),
    );
    expect(state.namespace).toBe(CONVERSATION_CORE_STORAGE_NAMESPACE);
    expect(state.namespace).toBe('aleya-travel:conversation-core:first-principles');
    expect(state.sessionId).toBeTruthy();
    expect(state.createdAt).toBe('2026-07-28T00:00:00.000Z');
  });

  it('returns the deterministic not-assembled reply without mutating state', () => {
    const state = createInitialConversationCoreState(
      new Date('2026-07-28T00:00:00.000Z'),
    );
    const result = processConversationTurn({
      message: 'Find me somewhere tropical',
      state,
    });
    expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(result.state).toEqual(state);
    expect(result.reply.includes('not been assembled')).toBe(true);
  });

  it('does not write localStorage', () => {
    localStorage.clear();
    processConversationTurn({ message: 'Sydney to Melbourne' });
    expect(localStorage.length).toBe(0);
  });
});
