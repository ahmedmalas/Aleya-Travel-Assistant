import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { selectConversationFollowUpQuestion } from '../../conversation-core/selectConversationFollowUpQuestion';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { interpretTravelUtterance } from '../interpretTravelUtterance';
import { buildInterpretationContext } from '../buildInterpretationContext';
import { buildInterpretationPrompt } from '../buildInterpretationPrompt';
import { resolveContextualTemporalSemantics } from '../contextualTemporalSemantics';
import { deriveActiveTravelRequirement } from '../deriveActiveRequirement';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;
const NOW = new Date('2026-08-04T00:00:00.000Z');

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'contextual-semantics',
      now: NOW,
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

async function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  mode: 'offline-semantic' | 'ai' = 'offline-semantic',
) {
  const interpretation = await interpretTravelUtterance({
    message,
    currentState: state,
    recentHistory: state.transcript,
    mode,
    now: NOW,
    ...(mode === 'ai'
      ? {
          aiInterpret: async (context) =>
            resolveContextualTemporalSemantics(context),
        }
      : {}),
  });
  return {
    interpretation,
    result: processConversationTurn({
      message,
      state,
      userEntryId: `u-${index}`,
      assistantEntryId: `a-${index}`,
      userMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2)),
      assistantMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2 + 1)),
      stateUpdate: interpretation.stateUpdate,
      skipExtraction: true,
    }),
  };
}

describe('Contextual interpretation architecture', () => {
  it('packages full travel state, anchors, history, and active requirement for AI', () => {
    const state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      transcript: [
        {
          id: '1',
          role: 'user',
          message: '28 August 2026',
          timestamp: '2026-08-04T00:00:00.000Z',
        },
        {
          id: '2',
          role: 'assistant',
          message: F.returnDate,
          timestamp: '2026-08-04T00:00:01.000Z',
        },
      ],
    });
    const requirement = deriveActiveTravelRequirement(state);
    expect(requirement).toBe('returnDate');

    const context = buildInterpretationContext({
      message: 'Monday of that week',
      currentState: state,
      activeRequirement: requirement,
      recentHistory: state.transcript,
      now: NOW,
    });

    expect(context.travelState.departureDate).toBe('2026-08-28');
    expect(context.travelState.destination).toBe('Melbourne');
    expect(context.temporalAnchors.primaryAnchorDate).toBe('2026-08-28');
    expect(context.temporalAnchors.primaryAnchorRole).toBe('departureDate');
    expect(context.lastAssistantMessage).toBe(F.returnDate);
    expect(context.recentHistory).toHaveLength(2);

    const prompt = buildInterpretationPrompt(context);
    expect(prompt).toContain('Monday of that week');
    expect(prompt).toContain('2026-08-28');
    expect(prompt).toContain('travel consultant');
    expect(prompt).toContain('weekday-of-week');
    expect(prompt).toContain(F.returnDate);
  });
});

describe('Multi-turn contextual relative references', () => {
  it('departure then Monday of that week resolves return and advances past return question', async () => {
    let state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
    });

    let step = await turn('28 August 2026', state, 0);
    expect(step.result.state.departureDate).toBe('2026-08-28');
    expect(selectConversationFollowUpQuestion(step.result.state)).toBe(
      F.returnDate,
    );

    state = step.result.state;
    step = await turn('Monday of that week', state, 1);
    // Fri 28 Aug week → Monday 24 Aug is before departure → following Monday 31 Aug
    expect(step.result.state.returnDate).toBe('2026-08-31');
    expect(selectConversationFollowUpQuestion(step.result.state)).not.toBe(
      F.returnDate,
    );
  });

  it('the day after departure becomes the return date while return is active', async () => {
    const state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      transcript: [
        {
          id: 'a1',
          role: 'assistant',
          message: F.returnDate,
          timestamp: '2026-08-04T00:00:01.000Z',
        },
      ],
    });
    const step = await turn('the day after', state, 0);
    expect(step.result.state.returnDate).toBe('2026-08-29');
  });

  it('four nights later derives return from departure anchor', async () => {
    const state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    const step = await turn('four nights later', state, 0);
    expect(step.result.state.returnDate).toBe('2026-09-01');
  });

  it('that weekend while return is missing uses Sunday of the departure week', async () => {
    const state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-28', // Friday
    });
    const step = await turn('that weekend', state, 0);
    expect(step.result.state.returnDate).toBe('2026-08-30');
  });

  it('change it to Friday corrects departure within the same week', async () => {
    const state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-26', // Wednesday
      returnDate: '2026-08-31',
      adultCount: 2,
      flightsRequested: true,
      accommodationRequested: false,
      carHireRequested: false,
    });
    const step = await turn('change it to Friday', state, 0);
    expect(step.result.state.departureDate).toBe('2026-08-28');
    expect(step.result.state.returnDate).toBe('2026-08-31');
    expect(step.result.state.destination).toBe('Melbourne');
    expect(step.result.state.origin).toBe('Sydney');
  });

  it('keep everything else with a Friday correction preserves unrelated slots', async () => {
    const state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-26',
      returnDate: '2026-09-02',
      adultCount: 2,
      childCount: 1,
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: false,
    });
    const step = await turn('change it to Friday — keep everything else', state, 0);
    expect(step.result.state.departureDate).toBe('2026-08-28');
    expect(step.result.state.returnDate).toBe('2026-09-02');
    expect(step.result.state.adultCount).toBe(2);
    expect(step.result.state.childCount).toBe(1);
    expect(step.result.state.accommodationRequested).toBe(true);
    expect(step.interpretation.semantic.preferences).toContain(
      'preserve_unmentioned_fields',
    );
  });

  it('same time records a time preference without clearing dates', async () => {
    const state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: null,
    });
    const interpretation = await interpretTravelUtterance({
      message: 'same time',
      currentState: state,
      recentHistory: state.transcript,
      mode: 'offline-semantic',
      now: NOW,
    });
    expect(interpretation.semantic.returnTimePreference).toMatch(/same/i);
    expect(interpretation.stateUpdate.departureDate).toBeUndefined();
    expect(interpretation.stateUpdate.destination).toBeUndefined();
  });

  it('the earlier flight becomes a preference note without inventing places', async () => {
    const state = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-08-31',
    });
    const interpretation = await interpretTravelUtterance({
      message: 'the earlier flight',
      currentState: state,
      mode: 'offline-semantic',
      now: NOW,
    });
    expect(interpretation.semantic.preferences).toContain('earlier_flight');
    expect(interpretation.stateUpdate.destination).toBeUndefined();
    expect(interpretation.stateUpdate.origin).toBeUndefined();
  });

  it('injected AI path receives full context and can resolve relative return dates', async () => {
    const state = createState({
      destination: 'Lebanon',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      transcript: [
        {
          id: 'u',
          role: 'user',
          message: '28 August',
          timestamp: '2026-08-04T00:00:00.000Z',
        },
        {
          id: 'a',
          role: 'assistant',
          message: F.returnDate,
          timestamp: '2026-08-04T00:00:01.000Z',
        },
      ],
    });

    const interpretation = await interpretTravelUtterance({
      message: 'Monday of that week',
      currentState: state,
      recentHistory: state.transcript,
      mode: 'ai',
      now: NOW,
      aiInterpret: async (context) => {
        expect(context.travelState.departureDate).toBe('2026-08-28');
        expect(context.activeRequirement).toBe('returnDate');
        expect(context.lastAssistantMessage).toBe(F.returnDate);
        return resolveContextualTemporalSemantics(context);
      },
    });

    expect(interpretation.source).toBe('ai');
    expect(interpretation.stateUpdate.returnDate).toBe('2026-08-31');
    expect(interpretation.context?.temporalAnchors.primaryAnchorDate).toBe(
      '2026-08-28',
    );
  });

  it('mixed multi-turn relative chain does not re-ask return date', async () => {
    let state = createState({
      destination: 'Brisbane',
      origin: 'Sydney',
    });
    let step = await turn('28 August 2026', state, 0);
    state = step.result.state;
    step = await turn('the day after', state, 1);
    expect(step.result.state.departureDate).toBe('2026-08-28');
    expect(step.result.state.returnDate).toBe('2026-08-29');
    expect(selectConversationFollowUpQuestion(step.result.state)).not.toBe(
      F.returnDate,
    );
  });
});
