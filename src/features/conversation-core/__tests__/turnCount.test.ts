import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const USER_AT = new Date('2026-07-29T00:00:00.000Z');
const ASSISTANT_AT = new Date('2026-07-29T00:00:01.000Z');
const CONVERSATION_ID = 'conversation-core-turncount-001';

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
): ReturnType<typeof processConversationTurn> {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-${index}`,
    assistantEntryId: `assistant-${index}`,
    userMessageAt: new Date(USER_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(ASSISTANT_AT.getTime() + index * 2000),
  });
}

describe('phase 2C — turnCount progression only', () => {
  it('initial state turnCount is 0', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    expect(state.turnCount).toBe(0);
  });

  it('first turn produces turnCount 1 with user then assistant roles', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const result = turn('Melbourne', initial, 0);
    expect(result.state.turnCount).toBe(1);
    expect(result.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(result.state.transcript).toHaveLength(2);
  });

  it('two sequential turns accumulate to turnCount 2 with four transcript entries', () => {
    let state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    state = turn('Hello', state, 0).state;
    state = turn('Melbourne', state, 1).state;
    expect(state.turnCount).toBe(2);
    expect(state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(state.transcript).toHaveLength(4);
  });

  it('six sequential turns produce turnCount 6 and twelve transcript entries', () => {
    let state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    for (let index = 0; index < 6; index += 1) {
      state = turn(`message-${index}`, state, index).state;
      expect(state.turnCount).toBe(index + 1);
      expect(state.transcript).toHaveLength((index + 1) * 2);
    }
    expect(state.turnCount).toBe(6);
    expect(state.transcript).toHaveLength(12);
  });

  it('increments the incoming turnCount rather than deriving it from transcript length', () => {
    const incoming: ConversationCoreState = {
      ...createInitialConversationCoreState({
        conversationId: CONVERSATION_ID,
        now: USER_AT,
      }),
      turnCount: 7,
      transcript: [],
    };
    const result = turn('Hello', incoming, 0);
    expect(result.state.turnCount).toBe(8);
    expect(result.state.transcript).toHaveLength(2);
    expect(result.state.turnCount).not.toBe(result.state.transcript.length / 2);
  });

  it('does not mutate the incoming state or transcript array', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const first = turn('Hello', initial, 0).state;
    const suppliedTranscript = first.transcript;
    const snapshot = first.transcript.map((entry) => ({ ...entry }));
    const priorTurnCount = first.turnCount;

    const result = turn('Melbourne', first, 1);

    expect(result.state).not.toBe(first);
    expect(result.state.transcript).not.toBe(suppliedTranscript);
    expect(first.transcript).toEqual(snapshot);
    expect(first.turnCount).toBe(priorTurnCount);
    expect(result.state.turnCount).toBe(2);
  });

  it('does not alter status, createdAt, updatedAt, or conversationId', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    let state = initial;
    for (let index = 0; index < 3; index += 1) {
      const result = turn(`m-${index}`, state, index);
      expect(result.state.status).toBe('empty');
      expect(result.state.createdAt).toBe(initial.createdAt);
      expect(result.state.updatedAt).toBe(initial.updatedAt);
      expect(result.state.conversationId).toBe(initial.conversationId);
      state = result.state;
    }
  });

  it('preserves Phase 2B transcript behaviour while incrementing turnCount', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    const first = processConversationTurn({
      message: 'Sydney to Gold Coast!!!!',
      state: initial,
      userEntryId: 'u1',
      assistantEntryId: 'a1',
      userMessageAt: USER_AT,
      assistantMessageAt: ASSISTANT_AT,
    });
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.state.transcript[0]?.id).toBe('u1');
    expect(first.state.transcript[1]?.id).toBe('a1');
    expect(first.state.transcript[0]?.timestamp).toBe(USER_AT.toISOString());
    expect(first.state.transcript[1]?.timestamp).toBe(ASSISTANT_AT.toISOString());
    expect(first.state.turnCount).toBe(1);

    const second = processConversationTurn({
      message: 'Sydney to Gold Coast!!!!',
      state: first.state,
      userEntryId: 'u2',
      assistantEntryId: 'a2',
      userMessageAt: new Date('2026-07-29T00:00:02.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:03.000Z'),
    });
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript[0]).toEqual(first.state.transcript[0]);
    expect(second.state.transcript[1]).toEqual(first.state.transcript[1]);
    expect(second.state.transcript[2]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(second.state.turnCount).toBe(2);
  });
});
