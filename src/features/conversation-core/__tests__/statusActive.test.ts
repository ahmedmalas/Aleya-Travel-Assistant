import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-status-active-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-${index}`,
    assistantEntryId: `assistant-${index}`,
    userMessageAt: new Date(CREATED_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(CREATED_AT.getTime() + index * 2000 + 1000),
  });
}

describe('phase 2E — status active only', () => {
  it('initial canonical state has status empty', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.status).toBe('empty');
  });

  it('one successful call returns status active', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('Melbourne', initial, 0);
    expect(result.state.status).toBe('active');
    expect(result.trace.stateStatus).toBe('active');
  });

  it('sequential calls keep status active', () => {
    let state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    state = turn('Hello', state, 0).state;
    expect(state.status).toBe('active');
    state = turn('Melbourne', state, 1).state;
    expect(state.status).toBe('active');
    state = turn('I want flights', state, 2).state;
    expect(state.status).toBe('active');
  });

  it('preserves transcript, turnCount, and updatedAt behaviour', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0);

    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);
    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.state.updatedAt).toBe(first.state.transcript[1]?.timestamp);
    expect(first.state.createdAt).toBe(initial.createdAt);
    expect(first.state.conversationId).toBe(CONVERSATION_ID);

    const second = turn('Sydney to Gold Coast!!!!', first.state, 1);
    expect(second.state.status).toBe('active');
    expect(second.state.turnCount).toBe(2);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript[0]).toEqual(first.state.transcript[0]);
    expect(second.state.updatedAt).toBe(second.state.transcript[3]?.timestamp);
  });
});
