import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { interpretTravelUtterance } from '../interpretTravelUtterance';
import {
  editDistance,
  recognizeTravelServicesInMessage,
} from '../serviceRecognitionSemantics';
import { buildInterpretationPrompt } from '../buildInterpretationPrompt';
import { buildInterpretationContext } from '../buildInterpretationContext';
import { deriveActiveTravelRequirement } from '../deriveActiveRequirement';
import { validateAndMapSemanticInterpretation } from '../validateAndMap';
import { interpretOfflineSemantic } from '../offlineSemanticInterpreter';

const NOW = new Date('2026-08-04T00:00:00.000Z');

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'multi-service',
      now: NOW,
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

async function turn(message: string, state = createState(), index = 0) {
  const interpretation = await interpretTravelUtterance({
    message,
    currentState: state,
    recentHistory: state.transcript,
    mode: 'offline-semantic',
    now: NOW,
  });
  const result = processConversationTurn({
    message,
    state,
    userEntryId: `u-${index}`,
    assistantEntryId: `a-${index}`,
    userMessageAt: NOW,
    assistantMessageAt: NOW,
    stateUpdate: interpretation.stateUpdate,
    skipExtraction: true,
  });
  return { interpretation, result };
}

describe('Multi-intent service recognition architecture', () => {
  it('loss locus: offline used to keep only flights; validation/merge were not the drop point', () => {
    const message = 'hotel flights and care hire';
    const state = createState();
    const offline = interpretOfflineSemantic({
      message,
      currentState: state,
      activeRequirement: deriveActiveTravelRequirement(state),
      now: NOW,
    });
    expect(offline.flightsRequested).toBe(true);
    expect(offline.accommodationRequested).toBe(true);
    expect(offline.carHireRequested).toBe(true);

    const mapped = validateAndMapSemanticInterpretation(offline, state);
    expect(mapped.stateUpdate.flightsRequested).toBe(true);
    expect(mapped.stateUpdate.accommodationRequested).toBe(true);
    expect(mapped.stateUpdate.carHireRequested).toBe(true);
  });

  it('recogniser returns the full service set from one multi-intent utterance', () => {
    const services = recognizeTravelServicesInMessage(
      'hotel flights and care hire',
    );
    expect([...services].sort()).toEqual(
      ['accommodation', 'carHire', 'flights'].sort(),
    );
    expect(editDistance('care', 'car')).toBe(1);
  });

  it('preserves every service through interpret → validate → merge', async () => {
    const { result, interpretation } = await turn(
      'hotel flights and care hire',
    );
    expect(interpretation.source).toBe('offline-semantic');
    expect(result.state.flightsRequested).toBe(true);
    expect(result.state.accommodationRequested).toBe(true);
    expect(result.state.carHireRequested).toBe(true);
  });

  it('order and conjunction variants keep the full set', async () => {
    const variants = [
      'flights hotel and car hire',
      'car hire, hotel, flights',
      'hotels and flights plus car rental',
      'I want flights accommodation and vehicle hire',
    ];
    for (const [index, message] of variants.entries()) {
      const { result } = await turn(message, createState(), index);
      expect(result.state.flightsRequested, message).toBe(true);
      expect(result.state.accommodationRequested, message).toBe(true);
      expect(result.state.carHireRequested, message).toBe(true);
    }
  });

  it('tolerates minor spelling mistakes without phrase-specific patches', async () => {
    const { result } = await turn('flights hotle and care hire');
    expect(result.state.flightsRequested).toBe(true);
    expect(result.state.accommodationRequested).toBe(true);
    expect(result.state.carHireRequested).toBe(true);
  });

  it('AI prompt requires preserving every service in multi-intent lists', () => {
    const state = createState();
    const prompt = buildInterpretationPrompt(
      buildInterpretationContext({
        message: 'hotel flights and care hire',
        currentState: state,
        activeRequirement: deriveActiveTravelRequirement(state),
        now: NOW,
      }),
    );
    expect(prompt).toMatch(/EVERY recognised service/i);
    expect(prompt).toMatch(/minor spelling mistakes/i);
  });

  it('does not invent services from unrelated chatter', async () => {
    const { result } = await turn('hello there');
    expect(result.state.flightsRequested).toBeNull();
    expect(result.state.accommodationRequested).toBeNull();
    expect(result.state.carHireRequested).toBeNull();
  });
});
