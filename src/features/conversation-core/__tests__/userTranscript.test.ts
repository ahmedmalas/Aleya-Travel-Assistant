import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
} from '../index';

const USER_AT = new Date('2026-07-29T00:00:00.000Z');
const ASSISTANT_AT = new Date('2026-07-29T00:00:01.000Z');
const CONVERSATION_ID = 'conversation-core-transcript-001';

describe('phase 2A carry-forward — raw user message recording', () => {
  it('stores user message byte-for-byte as the first entry of a turn', () => {
    const raw = '  Sydney to Gold Coast!!!!  ';
    const result = processConversationTurn({
      message: raw,
      conversationId: CONVERSATION_ID,
      userEntryId: 'user-raw',
      assistantEntryId: 'assistant-raw',
      userMessageAt: USER_AT,
      assistantMessageAt: ASSISTANT_AT,
    });
    expect(result.state.transcript[0]).toEqual({
      id: 'user-raw',
      role: 'user',
      message: raw,
      timestamp: '2026-07-29T00:00:00.000Z',
    });
    expect(result.state.transcript[0]?.message).not.toBe(raw.trim());
    expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });

  it('starts with an empty transcript from the factory', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: USER_AT,
    });
    expect(state.transcript).toEqual([]);
  });
});
