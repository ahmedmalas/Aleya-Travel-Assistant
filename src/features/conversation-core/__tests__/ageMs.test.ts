import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-age-ms-001';
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

describe('phase 2F — ageMs only', () => {
  it('initial state has ageMs === 0', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.ageMs).toBe(0);
  });

  it('one successful turn calculates the correct age', () => {
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

    expect(result.state.ageMs).toBe(
      assistantMessageAt.getTime() - new Date(initial.createdAt).getTime(),
    );
    expect(result.state.ageMs).toBe(5000);
  });

  it('sequential turns update ageMs using the latest assistant timestamp', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const firstAssistantAt = new Date('2026-07-29T00:00:01.000Z');
    const secondAssistantAt = new Date('2026-07-29T00:00:10.000Z');
    const thirdAssistantAt = new Date('2026-07-29T00:01:00.000Z');

    const first = turn(
      'Hello',
      initial,
      new Date('2026-07-29T00:00:00.500Z'),
      firstAssistantAt,
      { user: 'u1', assistant: 'a1' },
    );
    expect(first.state.ageMs).toBe(1000);

    const second = turn(
      'Melbourne',
      first.state,
      new Date('2026-07-29T00:00:09.000Z'),
      secondAssistantAt,
      { user: 'u2', assistant: 'a2' },
    );
    expect(second.state.ageMs).toBe(10000);

    const third = turn(
      'I want flights',
      second.state,
      new Date('2026-07-29T00:00:59.000Z'),
      thirdAssistantAt,
      { user: 'u3', assistant: 'a3' },
    );
    expect(third.state.ageMs).toBe(60000);
    expect(third.state.ageMs).toBe(
      thirdAssistantAt.getTime() - new Date(initial.createdAt).getTime(),
    );
  });

  it('createdAt remains unchanged across turns', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    let state = initial;
    for (let index = 0; index < 3; index += 1) {
      const result = turn(
        `m-${index}`,
        state,
        new Date(CREATED_AT.getTime() + index * 2000),
        new Date(CREATED_AT.getTime() + index * 2000 + 1000),
        { user: `u${index}`, assistant: `a${index}` },
      );
      expect(result.state.createdAt).toBe(initial.createdAt);
      state = result.state;
    }
  });

  it('preserves transcript, status, turnCount, and updatedAt behaviour', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const firstAssistantAt = new Date('2026-07-29T00:00:01.000Z');
    const first = turn(
      'Sydney to Gold Coast!!!!',
      initial,
      new Date('2026-07-29T00:00:00.500Z'),
      firstAssistantAt,
      { user: 'u1', assistant: 'a1' },
    );

    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);
    expect(first.state.ageMs).toBe(1000);
    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.state.updatedAt).toBe(firstAssistantAt.toISOString());
    expect(first.state.createdAt).toBe(initial.createdAt);
    expect(first.state.conversationId).toBe(CONVERSATION_ID);

    const secondAssistantAt = new Date('2026-07-29T00:00:03.000Z');
    const second = turn(
      'Sydney to Gold Coast!!!!',
      first.state,
      new Date('2026-07-29T00:00:02.000Z'),
      secondAssistantAt,
      { user: 'u2', assistant: 'a2' },
    );
    expect(second.state.status).toBe('active');
    expect(second.state.turnCount).toBe(2);
    expect(second.state.ageMs).toBe(3000);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript[0]).toEqual(first.state.transcript[0]);
    expect(second.state.updatedAt).toBe(secondAssistantAt.toISOString());
    expect(second.state.createdAt).toBe(initial.createdAt);
  });
});
