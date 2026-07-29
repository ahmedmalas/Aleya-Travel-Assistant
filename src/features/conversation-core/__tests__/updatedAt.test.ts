import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-updated-at-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function turn(
  message: string,
  state: ConversationCoreState,
  userMessageAt: Date,
  assistantMessageAt: Date,
  ids: { user: string; assistant: string },
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: ids.user,
    assistantEntryId: ids.assistant,
    userMessageAt,
    assistantMessageAt,
  });
}

describe('phase 2D — updatedAt progression only', () => {
  it('one call sets updatedAt to the injected assistantMessageAt', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const assistantMessageAt = new Date('2026-07-29T00:00:05.000Z');
    const result = turn(
      'Melbourne',
      initial,
      new Date('2026-07-29T00:00:04.000Z'),
      assistantMessageAt,
      { user: 'u1', assistant: 'a1' },
    );

    expect(result.state.updatedAt).toBe(assistantMessageAt.toISOString());
    expect(result.state.updatedAt).toBe('2026-07-29T00:00:05.000Z');
    expect(result.state.transcript[1]?.timestamp).toBe(result.state.updatedAt);
  });

  it('sequential calls replace updatedAt with the latest injected assistant timestamp', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const firstAssistantAt = new Date('2026-07-29T00:00:01.000Z');
    const secondAssistantAt = new Date('2026-07-29T00:00:03.000Z');

    const first = turn(
      'Hello',
      initial,
      new Date('2026-07-29T00:00:00.500Z'),
      firstAssistantAt,
      { user: 'u1', assistant: 'a1' },
    );
    expect(first.state.updatedAt).toBe('2026-07-29T00:00:01.000Z');

    const second = turn(
      'Melbourne',
      first.state,
      new Date('2026-07-29T00:00:02.000Z'),
      secondAssistantAt,
      { user: 'u2', assistant: 'a2' },
    );
    expect(second.state.updatedAt).toBe('2026-07-29T00:00:03.000Z');
    expect(second.state.updatedAt).not.toBe(first.state.updatedAt);
  });

  it('createdAt remains unchanged across calls', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn(
      'Hello',
      initial,
      new Date('2026-07-29T01:00:00.000Z'),
      new Date('2026-07-29T01:00:01.000Z'),
      { user: 'u1', assistant: 'a1' },
    );
    const second = turn(
      'Melbourne',
      first.state,
      new Date('2026-07-29T02:00:00.000Z'),
      new Date('2026-07-29T02:00:01.000Z'),
      { user: 'u2', assistant: 'a2' },
    );

    expect(first.state.createdAt).toBe(initial.createdAt);
    expect(second.state.createdAt).toBe(initial.createdAt);
    expect(second.state.createdAt).toBe('2026-07-29T00:00:00.000Z');
  });

  it('preserves transcript and turnCount behaviour while updating updatedAt', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn(
      'Sydney to Gold Coast!!!!',
      initial,
      new Date('2026-07-29T00:00:00.000Z'),
      new Date('2026-07-29T00:00:01.000Z'),
      { user: 'u1', assistant: 'a1' },
    );

    expect(first.state.turnCount).toBe(1);
    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.state.status).toBe('empty');
    expect(first.state.conversationId).toBe(CONVERSATION_ID);
    expect(first.state.updatedAt).toBe('2026-07-29T00:00:01.000Z');

    const second = turn(
      'Sydney to Gold Coast!!!!',
      first.state,
      new Date('2026-07-29T00:00:02.000Z'),
      new Date('2026-07-29T00:00:03.000Z'),
      { user: 'u2', assistant: 'a2' },
    );
    expect(second.state.turnCount).toBe(2);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript[0]).toEqual(first.state.transcript[0]);
    expect(second.state.updatedAt).toBe('2026-07-29T00:00:03.000Z');
  });
});
