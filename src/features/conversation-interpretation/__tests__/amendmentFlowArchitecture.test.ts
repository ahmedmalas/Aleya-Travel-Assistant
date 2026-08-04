import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../../conversation-core/selectConversationFollowUpQuestion';
import { interpretTravelUtterance } from '../interpretTravelUtterance';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;
const NOW = new Date('2026-08-04T00:00:00.000Z');

function createSearchReadyState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  const base = {
    ...createInitialConversationCoreState({
      conversationId: 'amendment-flow',
      now: NOW,
    }),
    status: 'active' as const,
    turnCount: 6,
    destination: 'Melbourne',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-08-31',
    destinationResolutionStatus: 'resolved' as const,
    originResolutionStatus: 'resolved' as const,
    flightsRequested: true,
    accommodationRequested: false,
    carHireRequested: true,
    adultCount: 1,
    childCount: 0,
    infantCount: 0,
    conversationComplete: true,
    searchExecutionRequested: null,
    amendmentResumeSearchReady: null,
    transcript: [] as ConversationCoreState['transcript'],
    ...overrides,
  };
  const summary = selectConversationFollowUpQuestion(base);
  return {
    ...base,
    transcript: [
      {
        id: 'a-ready',
        role: 'assistant',
        message: summary ?? F.tripReadyAlreadyComplete,
        timestamp: '2026-08-04T00:00:10.000Z',
      },
    ],
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

describe('Amendment flow architecture after search-ready', () => {
  it('reopens origin only, preserves unaffected fields, and returns to search-ready', async () => {
    let state = createSearchReadyState();
    expect(selectConversationFollowUpQuestion(state)).toMatch(
      /ready to search when you confirm/i,
    );

    let step = await turn('Can we change the origin?', state, 0);
    expect(step.interpretation.semantic.reopenFields).toContain('origin');
    expect(step.result.state.origin).toBeNull();
    expect(step.result.state.destination).toBe('Melbourne');
    expect(step.result.state.departureDate).toBe('2026-08-28');
    expect(step.result.state.returnDate).toBe('2026-08-31');
    expect(step.result.state.adultCount).toBe(1);
    expect(step.result.state.carHireRequested).toBe(true);
    expect(step.result.state.conversationComplete).toBe(false);
    expect(step.result.state.amendmentResumeSearchReady).toBe(true);
    expect(step.result.reply).toContain(F.origin);
    expect(step.result.reply).not.toMatch(/here's what i have for your trip/i);
    expect(step.result.reply).not.toMatch(/removed/i);

    state = step.result.state;
    step = await turn('Brisbane', state, 1);
    expect(step.result.state.origin).toBe('Brisbane');
    expect(step.result.state.destination).toBe('Melbourne');
    expect(step.result.state.conversationComplete).toBe(true);
    expect(step.result.state.amendmentResumeSearchReady).toBe(false);
    expect(step.result.reply).toMatch(/ready to search when you confirm/i);
    expect(step.result.reply).toMatch(/Brisbane/);
    expect(step.result.reply).toMatch(/Melbourne/);
  });

  it('reopens destination without repeating the search-ready summary', async () => {
    const state = createSearchReadyState();
    const step = await turn('change the destination', state, 0);
    expect(step.result.state.destination).toBeNull();
    expect(step.result.state.origin).toBe('Sydney');
    expect(step.result.reply).toContain(F.destination);
    expect(step.result.reply).not.toMatch(/here's what i have for your trip/i);
  });

  it('reopens travel dates as a class and asks departure first', async () => {
    const state = createSearchReadyState();
    const step = await turn('can we change the dates?', state, 0);
    expect(step.result.state.departureDate).toBeNull();
    expect(step.result.state.returnDate).toBeNull();
    expect(step.result.state.origin).toBe('Sydney');
    expect(step.result.reply).toContain(F.departureDate);
  });

  it('reopens traveller count while preserving places and dates', async () => {
    const state = createSearchReadyState();
    const step = await turn('change the traveller count', state, 0);
    expect(step.result.state.adultCount).toBeNull();
    expect(step.result.state.origin).toBe('Sydney');
    expect(step.result.state.destination).toBe('Melbourne');
    expect(step.result.reply).toContain(F.flightsAdultCount);
  });

  it('removes car hire and returns to search-ready with other details intact', async () => {
    const state = createSearchReadyState({ carHireRequested: true });
    const step = await turn('remove car hire', state, 0);
    expect(step.result.state.carHireRequested).toBe(false);
    expect(step.result.state.origin).toBe('Sydney');
    expect(step.result.state.destination).toBe('Melbourne');
    expect(step.result.state.conversationComplete).toBe(true);
    expect(step.result.reply).toMatch(/ready to search when you confirm/i);
    expect(step.result.reply).toMatch(/Services:\s*flights\b/i);
    expect(step.result.reply).not.toMatch(/Services:[^\n]*car hire/i);
  });

  it('adds hotel and returns to search-ready when passenger counts already exist', async () => {
    const state = createSearchReadyState({ accommodationRequested: false });
    const step = await turn('add hotel', state, 0);
    expect(step.result.state.accommodationRequested).toBe(true);
    expect(step.result.state.origin).toBe('Sydney');
    expect(step.result.state.adultCount).toBe(1);
    expect(step.result.state.conversationComplete).toBe(true);
    expect(step.result.reply).toMatch(/ready to search when you confirm/i);
    expect(step.result.reply).toMatch(/accommodation|hotel/i);
  });

  it('applies in-utterance origin replacement without a reopen question', async () => {
    const state = createSearchReadyState();
    const step = await turn('change the origin to Brisbane', state, 0);
    expect(step.result.state.origin).toBe('Brisbane');
    expect(step.result.state.destination).toBe('Melbourne');
    expect(step.result.state.conversationComplete).toBe(true);
    expect(step.result.reply).toMatch(/ready to search when you confirm/i);
    expect(step.result.reply).toMatch(/Brisbane/);
    expect(step.result.reply).not.toBe(F.origin);
  });

  it('does not treat confirmations as amendments', async () => {
    const state = createSearchReadyState();
    const step = await turn('confirmed', state, 0);
    expect(step.result.state.searchExecutionRequested).toBe(true);
    expect(step.result.state.origin).toBe('Sydney');
    expect(step.result.reply).toBe(
      CONVERSATION_REPLY_CATALOGUE.completion.searchExecuting,
    );
  });
});
