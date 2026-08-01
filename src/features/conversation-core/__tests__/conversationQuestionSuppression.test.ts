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
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

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
      conversationId: 'conversation-10e',
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
    userEntryId: 'user-10e',
    assistantEntryId: 'assistant-10e',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

function questionCount(reply: string): number {
  return (reply.match(/\?/g) ?? []).length;
}

describe('phase 10E — deterministic question suppression', () => {
  it('documents Phase 10E suppression in the reply boundary', () => {
    const source = readFileSync(FOLLOW_UP_SOURCE, 'utf8');
    expect(source).toContain('Phase 10E');
    expect(source).toMatch(/suppress/i);
    expect(source).not.toMatch(/replySource|nextRequiredField/);
  });

  it('suppresses the flight traveller question when adultCount is already known', () => {
    const result = turn(
      'book flights',
      completeCore({ adultCount: 2 }),
    );
    expect(result.state.adultCount).toBe(2);
    expect(result.reply).not.toMatch(/How many adults will be travelling/i);
    expect(result.reply).toBe(
      `Great, I've added flights to your trip. ${FOLLOW_UPS.childCount}`,
    );
  });

  it('suppresses the accommodation guest question when adultCount is already known', () => {
    const result = turn(
      'book a hotel',
      completeCore({ adultCount: 2 }),
    );
    expect(result.state.adultCount).toBe(2);
    expect(result.reply).not.toMatch(/How many guests will be staying/i);
    expect(result.reply).toBe(
      `Great, I've added accommodation to your trip. ${FOLLOW_UPS.childCount}`,
    );
  });

  it('falls through suppressed count questions to the next contextual question', () => {
    const toActivities = turn(
      'book flights. book a hotel. book activities',
      completeCore({ adultCount: 2, childCount: 2, infantCount: 1 }),
    );
    expect(toActivities.reply).toBe(
      "Great, I've added flights, accommodation and activities to your trip. What kinds of activities are you interested in?",
    );
    expect(toActivities.reply).not.toMatch(/adults will be travelling/i);
    expect(toActivities.reply).not.toMatch(/guests will be staying/i);

    const toDining = turn(
      'book flights. find restaurants',
      completeCore({ adultCount: 2, childCount: 2, infantCount: 1 }),
    );
    expect(toDining.reply).toBe(
      "Great, I've added flights and restaurants to your trip. What type of dining are you looking for?",
    );
    expect(toDining.reply).not.toMatch(/adults will be travelling/i);
    expect(questionCount(toDining.reply)).toBe(1);
  });

  it('returns the neutral continuation when all contextual questions are satisfied', () => {
    const result = turn(
      'book flights. book a hotel',
      completeCore({ adultCount: 2, childCount: 2, infantCount: 1 }),
    );
    expect(result.reply).toBe(
      `Great, I've added flights and accommodation to your trip. Tell me anything else that matters for this trip. ${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );

    expect(
      generateConversationReply({
        message: 'ignored',
        previousState: completeCore({
          adultCount: 2,
          childCount: 2,
          infantCount: 1,
          flightsRequested: true,
          accommodationRequested: true,
        }),
        state: completeCore({
          adultCount: 2,
          childCount: 2,
          infantCount: 1,
          flightsRequested: true,
          accommodationRequested: true,
          wildlifeRequested: true,
        }),
      }),
    ).toBe(
      `Great, I've added wildlife to your trip. Tell me anything else that matters for this trip. ${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );
  });

  it('leaves required-field progression unaffected by contextual suppression', () => {
    const missingDestination = turn(
      'book flights',
      createState({ adultCount: 2 }),
    );
    expect(missingDestination.reply).toBe(
      "Great, I've added flights to your trip. Where would you like to travel?",
    );

    const missingReturn = turn(
      'book a hotel',
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-09-01',
        adultCount: 2,
      }),
    );
    expect(missingReturn.reply).toBe(
      "Great, I've added accommodation to your trip. When would you like to return?",
    );
    expect(missingReturn.reply).not.toMatch(/guests will be staying/i);
  });

  it('emits only one follow-up question after suppression', () => {
    const replies = [
      turn(
        'book flights. book a hotel. book activities. find restaurants',
        completeCore({ adultCount: 2, childCount: 2, infantCount: 1 }),
      ).reply,
      turn(
        'book flights. book activities',
        completeCore({ adultCount: 2, childCount: 2, infantCount: 1 }),
      ).reply,
      turn('book flights', completeCore({ adultCount: 2, childCount: 2, infantCount: 1 })).reply,
    ];
    for (const reply of replies) {
      expect(questionCount(reply), reply).toBe(1);
      // Phase 15C joins acknowledgement + follow-up with a space (single line).
      expect(reply.split('\n')).toHaveLength(1);
      expect(reply.includes('?')).toBe(true);
    }
  });

  it('lets explicit stateUpdate values suppress contextual questions', () => {
    const suppressedByExplicitAdults = turn('book flights', completeCore(), {
      adultCount: 4,
    });
    expect(suppressedByExplicitAdults.state.adultCount).toBe(4);
    expect(suppressedByExplicitAdults.reply).toBe(
      `Great, I've added flights to your trip. ${FOLLOW_UPS.childCount}`,
    );
    expect(suppressedByExplicitAdults.reply).not.toMatch(
      /adults will be travelling/i,
    );

    const fallThroughAfterExplicit = turn(
      'book flights. book activities',
      completeCore({ childCount: 2, infantCount: 1 }),
      { adultCount: 2 },
    );
    expect(fallThroughAfterExplicit.reply).toBe(
      "Great, I've added flights and activities to your trip. What kinds of activities are you interested in?",
    );

    const accommodationSuppressed = turn('book a hotel', completeCore(), {
      adultCount: 1,
    });
    expect(accommodationSuppressed.reply).not.toMatch(
      /guests will be staying/i,
    );
    expect(accommodationSuppressed.reply).toBe(
      `Great, I've added accommodation to your trip. ${FOLLOW_UPS.childCount}`,
    );
  });
});
