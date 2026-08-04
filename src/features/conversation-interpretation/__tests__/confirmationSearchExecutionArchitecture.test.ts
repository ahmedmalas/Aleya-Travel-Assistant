import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../../conversation-core/selectConversationFollowUpQuestion';
import { buildInterpretationContext } from '../buildInterpretationContext';
import { resolveContextualConfirmationSemantics } from '../contextualConfirmationSemantics';
import { deriveActiveTravelRequirement } from '../deriveActiveRequirement';
import { interpretTravelUtterance } from '../interpretTravelUtterance';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;
const NOW = new Date('2026-08-04T00:00:00.000Z');

function createTripReadyState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  const summarySeed = {
    ...createInitialConversationCoreState({
      conversationId: 'confirm-search',
      now: NOW,
    }),
    status: 'active' as const,
    turnCount: 5,
    destination: 'Melbourne',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-08-31',
    destinationResolutionStatus: 'resolved' as const,
    originResolutionStatus: 'resolved' as const,
    flightsRequested: true,
    accommodationRequested: false,
    carHireRequested: false,
    adultCount: 1,
    childCount: 0,
    infantCount: 0,
    conversationComplete: true,
    searchExecutionRequested: null,
  };
  const summary = selectConversationFollowUpQuestion({
    ...summarySeed,
    transcript: [],
  });
  return {
    ...summarySeed,
    transcript: [
      {
        id: 'a-ready',
        role: 'assistant',
        message: summary ?? F.tripReadyAlreadyComplete,
        timestamp: '2026-08-04T00:00:10.000Z',
      },
    ],
    ...overrides,
  };
}

async function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
) {
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

describe('Confirmation → search execution architecture', () => {
  it('transitions confirmed from trip-ready into search execution without repeating the summary', async () => {
    const state = createTripReadyState();
    expect(deriveActiveTravelRequirement(state)).toBe('none');
    expect(selectConversationFollowUpQuestion(state)).toMatch(
      /ready to search when you confirm/i,
    );

    const step = await turn('confirmed', state, 0);
    expect(step.interpretation.semantic.intent).toBe('confirm');
    expect(step.interpretation.semantic.confirmation).toBe(true);
    expect(step.interpretation.semantic.searchExecutionRequested).toBe(true);
    expect(step.interpretation.stateUpdate.searchExecutionRequested).toBe(true);
    expect(step.result.state.searchExecutionRequested).toBe(true);
    expect(step.result.state.conversationComplete).toBe(true);

    expect(step.result.reply).toBe(
      CONVERSATION_REPLY_CATALOGUE.completion.searchExecuting,
    );
    expect(step.result.reply).not.toMatch(/here's what i have for your trip/i);
    expect(step.result.reply).not.toMatch(/ready to search when you confirm/i);
    expect(selectConversationFollowUpQuestion(step.result.state)).toBe(
      CONVERSATION_REPLY_CATALOGUE.completion.searchExecuting,
    );
  });

  it('recognises a confirmation meaning class, not a single phrase', async () => {
    const equivalents = [
      'confirmed',
      'confirm',
      'yes',
      'go ahead',
      'proceed',
      'search',
      'looks good',
      'ok',
    ];
    for (const [index, message] of equivalents.entries()) {
      const state = createTripReadyState();
      const step = await turn(message, state, index);
      expect(step.result.state.searchExecutionRequested, message).toBe(true);
      expect(step.result.reply, message).toBe(
        CONVERSATION_REPLY_CATALOGUE.completion.searchExecuting,
      );
      expect(step.result.reply, message).not.toMatch(
        /here's what i have for your trip/i,
      );
    }
  });

  it('does not treat confirmation as search execution before trip-ready', async () => {
    const state = createTripReadyState({
      conversationComplete: null,
      transcript: [
        {
          id: 'a-neutral',
          role: 'assistant',
          message: F.neutralContinuation,
          timestamp: '2026-08-04T00:00:10.000Z',
        },
      ],
    });
    const context = buildInterpretationContext({
      message: 'confirmed',
      currentState: state,
      activeRequirement: 'none',
      recentHistory: state.transcript,
      now: NOW,
    });
    expect(resolveContextualConfirmationSemantics(context)).toBeNull();

    const step = await turn('confirmed', state, 0);
    expect(step.result.state.searchExecutionRequested).not.toBe(true);
  });

  it('keeps search-execution reply stable once requested (no summary loop)', async () => {
    let state = createTripReadyState();
    let step = await turn('confirmed', state, 0);
    expect(step.result.reply).toBe(
      CONVERSATION_REPLY_CATALOGUE.completion.searchExecuting,
    );

    state = step.result.state;
    step = await turn('confirmed', state, 1);
    expect(step.result.state.searchExecutionRequested).toBe(true);
    expect(step.result.reply).not.toMatch(/here's what i have for your trip/i);
  });
});
