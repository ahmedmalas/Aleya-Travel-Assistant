import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../../conversation-core/selectConversationFollowUpQuestion';
import { deriveActiveTravelRequirement } from '../deriveActiveRequirement';
import { interpretTravelUtterance } from '../interpretTravelUtterance';
import { resolveTravellerCountSemantics } from '../travellerCountSemantics';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;
const NOW = new Date('2026-08-04T00:00:00.000Z');

function baseTrip(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'traveller-semantics',
      now: NOW,
    }),
    status: 'active',
    turnCount: 3,
    destination: 'Melbourne',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-08-31',
    destinationResolutionStatus: 'resolved',
    originResolutionStatus: 'resolved',
    flightsRequested: true,
    accommodationRequested: false,
    carHireRequested: false,
    adultCount: null,
    childCount: null,
    infantCount: null,
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

describe('Traveller count semantics architecture', () => {
  it('maps self-party meaning class to 1 adult when adultCount is active', async () => {
    const selfParty = ['myself', 'just me', 'only me', 'alone', 'solo', 'by myself'];
    for (const [index, message] of selfParty.entries()) {
      const state = baseTrip({
        transcript: [
          {
            id: 'a-adult',
            role: 'assistant',
            message: F.flightsAdultCount,
            timestamp: '2026-08-04T00:00:10.000Z',
          },
        ],
      });
      expect(deriveActiveTravelRequirement(state)).toBe('adultCount');
      const meaning = resolveTravellerCountSemantics({
        message,
        activeRequirement: 'adultCount',
      });
      expect(meaning, message).toEqual({ adultCount: 1 });

      const step = await turn(message, state, index);
      expect(step.interpretation.stateUpdate.adultCount, message).toBe(1);
      expect(step.result.state.adultCount, message).toBe(1);
      expect(selectConversationFollowUpQuestion(step.result.state)).toBe(
        F.childCount,
      );
    }
  });

  it('maps zero-quantity meaning class to 0 children when childCount is active', async () => {
    const zeroClass = ['none', 'no', 'zero', 'no children', 'nobody'];
    for (const [index, message] of zeroClass.entries()) {
      const state = baseTrip({
        adultCount: 1,
        childCount: null,
        transcript: [
          {
            id: 'a-child',
            role: 'assistant',
            message: F.childCount,
            timestamp: '2026-08-04T00:00:10.000Z',
          },
        ],
      });
      expect(deriveActiveTravelRequirement(state)).toBe('childCount');
      const step = await turn(message, state, index);
      expect(step.interpretation.stateUpdate.childCount, message).toBe(0);
      expect(step.result.state.childCount, message).toBe(0);
      expect(step.result.state.conversationComplete, message).not.toBe(true);
      expect(selectConversationFollowUpQuestion(step.result.state)).toBe(
        F.infantCount,
      );
    }
  });

  it('maps zero-quantity meaning class to 0 infants when infantCount is active', async () => {
    const state = baseTrip({
      adultCount: 2,
      childCount: 0,
      infantCount: null,
      transcript: [
        {
          id: 'a-infant',
          role: 'assistant',
          message: F.infantCount,
          timestamp: '2026-08-04T00:00:10.000Z',
        },
      ],
    });
    expect(deriveActiveTravelRequirement(state)).toBe('infantCount');
    const step = await turn('none', state, 0);
    expect(step.result.state.infantCount).toBe(0);
    expect(step.result.state.conversationComplete).not.toBe(true);
  });

  it('does not treat bare no as zero adults when adultCount is active', async () => {
    const state = baseTrip({
      transcript: [
        {
          id: 'a-adult',
          role: 'assistant',
          message: F.flightsAdultCount,
          timestamp: '2026-08-04T00:00:10.000Z',
        },
      ],
    });
    const step = await turn('no', state, 0);
    expect(step.result.state.adultCount).toBeNull();
    expect(selectConversationFollowUpQuestion(step.result.state)).toBe(
      F.flightsAdultCount,
    );
  });

  it('fills bare cardinals into the active traveller slot', async () => {
    const adultState = baseTrip();
    const adultStep = await turn('2', adultState, 0);
    expect(adultStep.result.state.adultCount).toBe(2);

    const childState = baseTrip({ adultCount: 2 });
    const childStep = await turn('one', childState, 1);
    expect(childStep.result.state.childCount).toBe(1);
  });
});
