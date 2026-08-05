import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { selectConversationFollowUpQuestion } from '../../conversation-core/selectConversationFollowUpQuestion';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { interpretTravelUtterance } from '../interpretTravelUtterance';
import { extractRelativeDurationMeaning } from '../relativeDurationSemantics';
import { buildInterpretationPrompt } from '../buildInterpretationPrompt';
import { buildInterpretationContext } from '../buildInterpretationContext';
import { deriveActiveTravelRequirement } from '../deriveActiveRequirement';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;
const NOW = new Date('2026-08-04T00:00:00.000Z');
const DEPARTURE = '2026-08-28';
const EXPECTED_RETURN = '2026-09-11'; // +14 days

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'relative-duration',
      now: NOW,
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Melbourne',
    origin: 'Sydney',
    departureDate: DEPARTURE,
    destinationResolutionStatus: 'resolved',
    originResolutionStatus: 'resolved',
    transcript: [
      {
        id: 'a',
        role: 'assistant',
        message: F.returnDate,
        timestamp: NOW.toISOString(),
      },
    ],
    ...overrides,
  };
}

async function turn(message: string, state: ConversationCoreState, index: number) {
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
    userMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2 + 1)),
    stateUpdate: interpretation.stateUpdate,
    skipExtraction: true,
  });
  return { interpretation, result };
}

describe('Relative duration semantic class', () => {
  it('quantity × unit normalises week/day/fortnight surfaces to the same day offset', () => {
    const surfaces = [
      'after 2 weeks',
      'after 14 days',
      'in two weeks',
      'two weeks later',
      'after a fortnight',
      'stay for 14 days',
      'stay two weeks',
      'for 14 days',
      '14 days later',
      'for two weeks',
    ];
    for (const surface of surfaces) {
      const meaning = extractRelativeDurationMeaning(surface.toLowerCase());
      expect(meaning?.dayOffset, surface).toBe(14);
    }
  });

  it('AI prompt instructs relative-duration class reasoning against anchors', () => {
    const state = createState();
    const context = buildInterpretationContext({
      message: 'after 2 weeks',
      currentState: state,
      activeRequirement: deriveActiveTravelRequirement(state),
      recentHistory: state.transcript,
      now: NOW,
    });
    const prompt = buildInterpretationPrompt(context);
    expect(prompt).toMatch(/relative durations are ONE semantic class/i);
    expect(prompt).toMatch(/week=7/);
    expect(prompt).toMatch(/fortnight=14/);
    expect(prompt).toContain(DEPARTURE);
    expect(context.activeRequirement).toBe('returnDate');
  });

  it('multi-turn: departure then relative-duration class yields departure+14 return', async () => {
    const surfaces = [
      'after 2 weeks',
      'after 14 days',
      'in two weeks',
      'two weeks later',
      'after a fortnight',
      'stay for 14 days',
      'stay two weeks',
    ];

    for (const [index, message] of surfaces.entries()) {
      const state = createState();
      const { result, interpretation } = await turn(message, state, index);
      expect(result.state.departureDate, message).toBe(DEPARTURE);
      expect(result.state.returnDate, message).toBe(EXPECTED_RETURN);
      expect(selectConversationFollowUpQuestion(result.state), message).not.toBe(
        F.returnDate,
      );
      expect(interpretation.stateUpdate.returnDate, message).toBe(EXPECTED_RETURN);
    }
  });

  it('one week and three weeks scale by unit, not phrase memory', async () => {
    const week = await turn('after 1 week', createState(), 0);
    expect(week.result.state.returnDate).toBe('2026-09-04');

    const three = await turn('in three weeks', createState(), 1);
    expect(three.result.state.returnDate).toBe('2026-09-18');
  });

  it('night-framed durations still resolve return from the same duration architecture', async () => {
    const step = await turn('four nights later', createState(), 0);
    expect(step.result.state.returnDate).toBe('2026-09-01');
    expect(step.interpretation.semantic.nightCount).toBe(4);
  });
});
