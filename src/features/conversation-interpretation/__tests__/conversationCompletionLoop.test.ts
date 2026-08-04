import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { selectConversationFollowUpQuestion } from '../../conversation-core/selectConversationFollowUpQuestion';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { interpretTravelUtterance } from '../interpretTravelUtterance';
import { resolveContextualCompletionSemantics } from '../contextualCompletionSemantics';
import { buildInterpretationContext } from '../buildInterpretationContext';
import { deriveActiveTravelRequirement } from '../deriveActiveRequirement';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;
const NOW = new Date('2026-08-04T00:00:00.000Z');

function createCompleteTrip(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'completion-loop',
      now: NOW,
    }),
    status: 'active',
    turnCount: 4,
    destination: 'Melbourne',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-08-31',
    destinationResolutionStatus: 'resolved',
    originResolutionStatus: 'resolved',
    flightsRequested: true,
    accommodationRequested: false,
    carHireRequested: false,
    adultCount: 2,
    childCount: 0,
    infantCount: 0,
    transcript: [
      {
        id: 'a-neutral',
        role: 'assistant',
        message: F.neutralContinuation,
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

describe('Conversation completion loop', () => {
  it('without completion, complete trips still receive the neutral optional follow-up', () => {
    const state = createCompleteTrip({ conversationComplete: null });
    expect(selectConversationFollowUpQuestion(state)).toBe(
      F.neutralContinuation,
    );
  });

  it('that’s it sets conversationComplete and leaves the what-else loop', async () => {
    const state = createCompleteTrip();
    expect(deriveActiveTravelRequirement(state)).toBe('none');

    const step = await turn("that's it", state, 0);
    expect(step.interpretation.stateUpdate.conversationComplete).toBe(true);
    expect(step.result.state.conversationComplete).toBe(true);
    expect(step.result.reply).not.toContain(F.neutralContinuation);
    expect(step.result.reply).toMatch(/ready to search when you confirm/i);
    expect(step.result.reply).toMatch(/Melbourne/);
    expect(step.result.reply).toMatch(/Sydney/);
  });

  it('that’s it then nothing stays out of the optional what-else loop', async () => {
    let state = createCompleteTrip();
    let step = await turn("that's it", state, 0);
    expect(step.result.reply).not.toContain(F.neutralContinuation);

    state = step.result.state;
    step = await turn('nothing', state, 1);
    expect(step.result.state.conversationComplete).toBe(true);
    expect(step.result.reply).not.toContain(F.neutralContinuation);
    expect(step.result.reply).toMatch(/ready to search when you confirm/i);
    expect(selectConversationFollowUpQuestion(step.result.state)).not.toBe(
      F.neutralContinuation,
    );
  });

  it('recognises a family of natural completion equivalents in optional context', async () => {
    const equivalents = [
      "that's it",
      'nothing else',
      'nothing',
      'no',
      'all done',
      "that's all",
      'no thanks',
      "that'll be all",
    ];

    for (const [index, message] of equivalents.entries()) {
      const state = createCompleteTrip();
      const step = await turn(message, state, index);
      expect(step.result.state.conversationComplete, message).toBe(true);
      expect(step.result.reply, message).not.toContain(F.neutralContinuation);
      expect(step.result.reply, message).toMatch(
        /ready to search when you confirm/i,
      );
    }
  });

  it('does not treat bare no as completion while a required date slot is active', async () => {
    const state = createCompleteTrip({
      returnDate: null,
      transcript: [
        {
          id: 'a-return',
          role: 'assistant',
          message: F.returnDate,
          timestamp: '2026-08-04T00:00:10.000Z',
        },
      ],
    });
    const context = buildInterpretationContext({
      message: 'no',
      currentState: state,
      activeRequirement: 'returnDate',
      recentHistory: state.transcript,
      now: NOW,
    });
    expect(resolveContextualCompletionSemantics(context)).toBeNull();

    const step = await turn('no', state, 0);
    expect(step.result.state.conversationComplete).not.toBe(true);
    expect(selectConversationFollowUpQuestion(step.result.state)).toBe(
      F.returnDate,
    );
  });

  it('injected AI completion path receives context and maps conversationComplete', async () => {
    const state = createCompleteTrip();
    const interpretation = await interpretTravelUtterance({
      message: "that's it",
      currentState: state,
      recentHistory: state.transcript,
      mode: 'ai',
      now: NOW,
      aiInterpret: async (context) => {
        expect(context.activeRequirement).toBe('none');
        expect(context.lastAssistantMessage).toBe(F.neutralContinuation);
        return resolveContextualCompletionSemantics(context);
      },
    });
    expect(interpretation.source).toBe('ai');
    expect(interpretation.stateUpdate.conversationComplete).toBe(true);
  });

  it('summarises captured trip details on completion', async () => {
    const state = createCompleteTrip({
      accommodationRequested: true,
      carHireRequested: true,
    });
    const step = await turn('all done', state, 0);
    expect(step.result.reply).toMatch(/Destination: Melbourne/);
    expect(step.result.reply).toMatch(/Origin: Sydney/);
    expect(step.result.reply).toMatch(/Depart: 2026-08-28/);
    expect(step.result.reply).toMatch(/Return: 2026-08-31/);
    expect(step.result.reply).toMatch(/flights/);
    expect(step.result.reply).toMatch(/accommodation/);
    expect(step.result.reply).toMatch(/car hire/);
  });
});
