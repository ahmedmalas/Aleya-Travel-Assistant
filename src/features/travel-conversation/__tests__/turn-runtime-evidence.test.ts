import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearConversationTraces,
  resetTravelConversation,
  sendTravelMessage,
} from '../index';

const NOW = new Date('2026-07-01T12:00:00.000Z');

beforeEach(() => {
  resetTravelConversation();
  clearConversationTraces();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  clearConversationTraces();
});

describe('Per-turn runtime evidence', () => {
  it('attaches same-call evidence for Melbourne then Sydney', () => {
    const first = sendTravelMessage({ message: 'I want to go melbourne', now: NOW });
    expect(first.runtimeEvidence.engineEntry).toBe('runConversationTurn');
    expect(first.runtimeEvidence.replySource).toBe('generateResponse');
    expect(first.runtimeEvidence.nextRequiredField).toBe('origin');
    expect(first.runtimeEvidence.generatedReply).toBe(first.reply);
    expect(first.reply).toMatch(/Melbourne/i);

    const second = sendTravelMessage({ message: 'Sydney', now: NOW });
    expect(second.runtimeEvidence.engineEntry).toBe('runConversationTurn');
    expect(second.runtimeEvidence.replySource).toBe('generateResponse');
    expect(second.runtimeEvidence.nextRequiredField).toBe('departureDate');
    expect(second.runtimeEvidence.generatedReply).toBe(
      'Which date would you like to travel?',
    );
    expect(second.reply).toBe(second.runtimeEvidence.generatedReply);
    expect(second.runtimeEvidence.conversationSessionId).toBe(
      first.runtimeEvidence.conversationSessionId,
    );
    expect(second.runtimeEvidence.turnNumber).toBeGreaterThan(
      first.runtimeEvidence.turnNumber,
    );
  });
});
