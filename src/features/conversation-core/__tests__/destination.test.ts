import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-destination-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  destination?: string,
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-${index}`,
    assistantEntryId: `assistant-${index}`,
    userMessageAt: new Date(CREATED_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(CREATED_AT.getTime() + index * 2000 + 1000),
    ...(destination !== undefined ? { stateUpdate: { destination } } : {}),
  });
}

describe('phase 3A — explicit destination only', () => {
  it('initial destination is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.destination).toBeNull();
  });

  it('injected destination is stored byte-for-byte', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const raw = '  Gold Coast!!!!  ';
    const result = turn('I want to visit Melbourne', initial, 0, raw);
    expect(result.state.destination).toBe(raw);
    expect(result.state.destination).toBe('  Gold Coast!!!!  ');
  });

  it('omitting destination preserves the existing value when the message is unsupported', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, 'Melbourne');
    expect(first.state.destination).toBe('Melbourne');

    const second = turn('hello again', first.state, 1);
    expect(second.state.destination).toBe('Melbourne');
  });

  it('a later injected destination replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, 'Melbourne');
    expect(first.state.destination).toBe('Melbourne');

    const second = turn('change destination', first.state, 1, 'Gold Coast');
    expect(second.state.destination).toBe('Gold Coast');
  });

  it('unsupported user message text alone never changes destination', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'to Melbourne',
      'change to Brisbane',
      'instead of Perth',
      'Brisbane',
      'Sydney please',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.destination).toBeNull();
      state = result.state;
    });
  });

  it('explicit destination cue in the message updates destination', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('go to Sydney', initial, 0);
    expect(result.state.destination).toBe('Sydney');
  });

  it('trusted explicit stateUpdate overrides an extracted destination', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('go to Brisbane', initial, 0, 'Perth');
    expect(result.state.destination).toBe('Perth');
  });

  it('preserves transcript, status, turn count, timestamps and placeholder reply', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0, 'Gold Coast');

    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);
    expect(first.state.ageMs).toBe(1000);
    expect(first.state.updatedAt).toBe('2026-07-29T00:00:01.000Z');
    expect(first.state.createdAt).toBe(initial.createdAt);
    expect(first.state.conversationId).toBe(CONVERSATION_ID);
    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('Sydney to Gold Coast!!!!', first.state, 1);
    expect(second.state.destination).toBe('Gold Coast');
    expect(second.state.status).toBe('active');
    expect(second.state.turnCount).toBe(2);
    expect(second.state.ageMs).toBe(3000);
    expect(second.state.updatedAt).toBe('2026-07-29T00:00:03.000Z');
    expect(second.state.createdAt).toBe(initial.createdAt);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript[0]).toEqual(first.state.transcript[0]);
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
