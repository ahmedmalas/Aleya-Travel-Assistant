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
import {
  hasOrderedDestinationListStructure,
  resolveTripStructureSemantics,
} from '../tripStructureSemantics';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;
const NOW = new Date('2026-08-04T00:00:00.000Z');

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

describe('Multi-city trip structure architecture', () => {
  it('loses no second destination from an ordered destination list', async () => {
    let state: ConversationCoreState = {
      ...createInitialConversationCoreState({
        conversationId: 'multi-city',
        now: NOW,
      }),
      status: 'active',
      turnCount: 1,
    };

    let step = await turn('I have a multi destination.', state, 0);
    expect(step.result.state.tripStructure).toBe('multi_city');
    expect(deriveActiveTravelRequirement(step.result.state)).toBe(
      'destinationStops',
    );
    expect(step.result.reply).toContain(F.multiCityDestinations);

    state = step.result.state;
    step = await turn('Melbourne then Perth.', state, 1);
    expect(step.interpretation.stateUpdate.destinationStops).toEqual([
      'Melbourne',
      'Perth',
    ]);
    expect(step.result.state.destinationStops).toEqual(['Melbourne', 'Perth']);
    expect(step.result.state.destination).toBe('Melbourne');
    expect(step.result.state.tripStructure).toBe('multi_city');
    expect(step.result.state.tripLegs).toEqual([
      { origin: null, destination: 'Melbourne', departureDate: null },
      { origin: 'Melbourne', destination: 'Perth', departureDate: null },
    ]);
    expect(step.result.reply).toMatch(/Melbourne.*Perth/i);
    expect(step.result.reply).toContain(F.origin);
    expect(selectConversationFollowUpQuestion(step.result.state)).toBe(F.origin);
  });

  it('treats ordered multi-place destination lists as multi-city without a prior declaration', async () => {
    const state: ConversationCoreState = {
      ...createInitialConversationCoreState({
        conversationId: 'multi-city-implicit',
        now: NOW,
      }),
      status: 'active',
      turnCount: 0,
    };
    const step = await turn('Melbourne then Perth.', state, 0);
    expect(step.result.state.tripStructure).toBe('multi_city');
    expect(step.result.state.destinationStops).toEqual(['Melbourne', 'Perth']);
    expect(step.result.state.tripLegs?.map((leg) => leg.destination)).toEqual([
      'Melbourne',
      'Perth',
    ]);
  });

  it('switches planner away from single-destination + return progression', async () => {
    const state: ConversationCoreState = {
      ...createInitialConversationCoreState({
        conversationId: 'multi-city-progress',
        now: NOW,
      }),
      status: 'active',
      tripStructure: 'multi_city',
      destinationStops: ['Melbourne', 'Perth'],
      destination: 'Melbourne',
      destinationResolutionStatus: 'resolved',
      tripLegs: [
        { origin: null, destination: 'Melbourne', departureDate: null },
        { origin: 'Melbourne', destination: 'Perth', departureDate: null },
      ],
    };
    expect(selectConversationFollowUpQuestion(state)).toBe(F.origin);
    expect(selectConversationFollowUpQuestion(state)).not.toBe(F.returnDate);

    const withOrigin = { ...state, origin: 'Sydney', originResolutionStatus: 'resolved' as const };
    expect(selectConversationFollowUpQuestion(withOrigin)).toBe(F.departureDate);

    const withDepart = {
      ...withOrigin,
      departureDate: '2026-09-01',
      tripLegs: [
        { origin: 'Sydney', destination: 'Melbourne', departureDate: '2026-09-01' },
        { origin: 'Melbourne', destination: 'Perth', departureDate: null },
      ],
    };
    // Multi-city core complete → optional/neutral, not return-date question.
    expect(selectConversationFollowUpQuestion(withDepart)).not.toBe(F.returnDate);
  });

  it('detects trip-structure meaning classes, not a single connective patch', () => {
    expect(
      resolveTripStructureSemantics({
        message: 'I have a multi destination',
        placesInOrder: [],
      })?.tripStructure,
    ).toBe('multi_city');

    expect(
      resolveTripStructureSemantics({
        message: 'one way to Cairns',
        placesInOrder: ['Cairns'],
      })?.tripStructure,
    ).toBe('one_way');

    expect(
      resolveTripStructureSemantics({
        message: 'round trip to Hobart',
        placesInOrder: ['Hobart'],
      })?.tripStructure,
    ).toBe('return');

    expect(
      hasOrderedDestinationListStructure('Melbourne then Perth', [
        'Melbourne',
        'Perth',
      ]),
    ).toBe(true);
    expect(
      hasOrderedDestinationListStructure('Melbourne, Perth', [
        'Melbourne',
        'Perth',
      ]),
    ).toBe(true);
    expect(
      hasOrderedDestinationListStructure('Melbourne followed by Perth', [
        'Melbourne',
        'Perth',
      ]),
    ).toBe(true);
  });

  it('rebuilds legs when origin is supplied after multi-city destinations', async () => {
    let state: ConversationCoreState = {
      ...createInitialConversationCoreState({
        conversationId: 'multi-city-legs',
        now: NOW,
      }),
      status: 'active',
      tripStructure: 'multi_city',
      destinationStops: ['Melbourne', 'Perth'],
      destination: 'Melbourne',
      destinationResolutionStatus: 'resolved',
      tripLegs: [
        { origin: null, destination: 'Melbourne', departureDate: null },
        { origin: 'Melbourne', destination: 'Perth', departureDate: null },
      ],
    };
    const step = await turn('from Sydney', state, 0);
    expect(step.result.state.origin).toBe('Sydney');
    expect(step.result.state.tripLegs).toEqual([
      { origin: 'Sydney', destination: 'Melbourne', departureDate: null },
      { origin: 'Melbourne', destination: 'Perth', departureDate: null },
    ]);
    expect(step.result.state.destinationStops).toEqual(['Melbourne', 'Perth']);
  });
});
