import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  generateConversationReply,
} from '../generateConversationReply';

const ROOT = process.cwd();
const FOLLOW_UP_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-10d',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
    ...overrides,
  });
}

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-10d',
    assistantEntryId: 'assistant-10d',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

function questionCount(reply: string): number {
  return (reply.match(/\?/g) ?? []).length;
}

describe('phase 10D — deterministic requirement-aware questions', () => {
  it('documents Phase 10D contextual follow-ups in the reply boundary', () => {
    const source = readFileSync(FOLLOW_UP_SOURCE, 'utf8');
    expect(source).toContain('Phase 10D');
    expect(source).toContain('How many adults will be travelling?');
    expect(source).toContain('How many guests will be staying?');
    expect(source).toContain(
      'What kinds of activities are you interested in?',
    );
    expect(source).toContain('What type of dining are you looking for?');
    expect(source).not.toMatch(/replySource|nextRequiredField/);
  });

  it('asks for traveller count when flights are requested and adultCount is missing', () => {
    const result = turn('book flights', completeCore());
    expect(result.state.flightsRequested).toBe(true);
    expect(result.state.adultCount).toBeNull();
    expect(result.reply).toBe(
      "I've added flights to your trip requirements.\nHow many adults will be travelling?",
    );
    expect(questionCount(result.reply)).toBe(1);
  });

  it('asks for guest count when accommodation is requested and adultCount is missing', () => {
    const result = turn('book a hotel', completeCore());
    expect(result.state.accommodationRequested).toBe(true);
    expect(result.reply).toBe(
      "I've added accommodation to your trip requirements.\nHow many guests will be staying?",
    );
    expect(questionCount(result.reply)).toBe(1);
  });

  it('asks about activity interests when activities are requested', () => {
    const result = turn('book activities', completeCore({ adultCount: 2 }));
    expect(result.state.activitiesRequested).toBe(true);
    expect(result.reply).toBe(
      "I've added activities to your trip requirements.\nWhat kinds of activities are you interested in?",
    );
    expect(questionCount(result.reply)).toBe(1);
  });

  it('asks about dining when restaurants are requested', () => {
    const result = turn('find restaurants', completeCore({ adultCount: 2 }));
    expect(result.state.restaurantsRequested).toBe(true);
    expect(result.reply).toBe(
      "I've added restaurants to your trip requirements.\nWhat type of dining are you looking for?",
    );
    expect(questionCount(result.reply)).toBe(1);
  });

  it('uses deterministic contextual priority when multiple services are requested', () => {
    const flightsOverAccommodation = turn(
      'book flights. book a hotel',
      completeCore(),
    );
    expect(flightsOverAccommodation.reply).toBe(
      "I've added flights and accommodation to your trip requirements.\nHow many adults will be travelling?",
    );

    const accommodationOverActivities = turn(
      'book a hotel. book activities',
      completeCore(),
    );
    expect(accommodationOverActivities.reply).toBe(
      "I've added accommodation and activities to your trip requirements.\nHow many guests will be staying?",
    );

    const activitiesOverRestaurants = turn(
      'book activities. find restaurants',
      completeCore({ adultCount: 2 }),
    );
    expect(activitiesOverRestaurants.reply).toBe(
      "I've added activities and restaurants to your trip requirements.\nWhat kinds of activities are you interested in?",
    );
  });

  it('keeps required travel-field questions ahead of contextual questions', () => {
    const result = turn('book flights', createState());
    expect(result.reply).toBe(
      "I've added flights to your trip requirements.\nWhere would you like to travel?",
    );
    expect(result.reply).not.toMatch(/adults will be travelling/i);

    const missingReturn = turn(
      'book a hotel',
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-09-01',
      }),
    );
    expect(missingReturn.reply).toBe(
      "I've added accommodation to your trip requirements.\nWhen would you like to return?",
    );
    expect(missingReturn.reply).not.toMatch(/guests will be staying/i);
  });

  it('produces only one follow-up question', () => {
    const replies = [
      turn('book flights', completeCore()).reply,
      turn('book a hotel', completeCore()).reply,
      turn('book activities', completeCore({ adultCount: 2 })).reply,
      turn(
        'book flights. book a hotel. book activities. find restaurants',
        completeCore(),
      ).reply,
    ];
    for (const reply of replies) {
      expect(questionCount(reply), reply).toBe(1);
      expect(reply.split('\n')).toHaveLength(2);
    }
  });

  it('retains the neutral continuation when no contextual question applies', () => {
    const beachesOnly = turn('show me beaches', completeCore({ adultCount: 2 }));
    expect(beachesOnly.reply).toBe(
      `I've added beaches to your trip requirements.\n${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );

    const flightsWithAdults = turn(
      'book flights',
      completeCore({ adultCount: 2 }),
    );
    expect(flightsWithAdults.reply).toBe(
      `I've added flights to your trip requirements.\n${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );

    expect(
      generateConversationReply({
        message: 'ignored',
        previousState: completeCore({
          adultCount: 2,
          flightsRequested: true,
        }),
        state: completeCore({
          adultCount: 2,
          flightsRequested: true,
          wildlifeRequested: true,
        }),
      }),
    ).toBe(
      `I've added wildlife to your trip requirements.\n${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );
  });

  it('respects explicit stateUpdate for contextual progression', () => {
    const forcedFlights = turn('Hello', completeCore(), {
      flightsRequested: true,
    });
    expect(forcedFlights.reply).toBe(
      "I've added flights to your trip requirements.\nHow many adults will be travelling?",
    );

    const adultsSatisfied = turn('book flights', completeCore(), {
      adultCount: 3,
    });
    expect(adultsSatisfied.state.adultCount).toBe(3);
    expect(adultsSatisfied.reply).toBe(
      `I've added flights to your trip requirements.\n${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );

    const forcedActivities = turn(
      'Hello',
      completeCore({ adultCount: 2 }),
      { activitiesRequested: true },
    );
    expect(forcedActivities.reply).toBe(
      "I've added activities to your trip requirements.\nWhat kinds of activities are you interested in?",
    );
  });
});
