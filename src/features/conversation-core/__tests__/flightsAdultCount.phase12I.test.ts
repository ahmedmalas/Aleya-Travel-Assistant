import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12I — flights adult-count follow-up characterisation.
 *
 * Locks the existing flights adult-count follow-up boundary and catalogue
 * wording before travel-consultant wording refinement. Does not change
 * production behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12i-flights-adult-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    }),
    status: 'active',
    turnCount: 1,
    ...overrides,
  };
}

/** Core progression fields complete; no contextual service requested. */
function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-09-05',
    ...overrides,
  });
}

describe('phase 12I — flights adult-count follow-up characterisation', () => {
  it('uses the exact catalogue flights adult-count follow-up wording', () => {
    expect(FOLLOW_UPS.flightsAdultCount).toBe(
      'How many adults will be travelling?',
    );
  });

  it('selects the flights adult-count follow-up when flights are requested, adultCount is missing, and core travel fields are supplied', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.flightsAdultCount);
  });

  it('skips the flights adult-count follow-up when adultCount is supplied', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          adultCount: 2,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.flightsAdultCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          adultCount: 2,
        }),
      ),
    ).toBe(FOLLOW_UPS.childCount);
  });

  it('selects the flights adult-count follow-up again when adultCount is explicitly removed', () => {
    const withAdultCount = completeCore({
      flightsRequested: true,
      adultCount: 2,
    });
    expect(selectConversationFollowUpQuestion(withAdultCount)).not.toBe(
      FOLLOW_UPS.flightsAdultCount,
    );

    const afterRemoval = {
      ...withAdultCount,
      adultCount: null,
    };
    expect(selectConversationFollowUpQuestion(afterRemoval)).toBe(
      FOLLOW_UPS.flightsAdultCount,
    );
  });

  it('does not select the flights adult-count follow-up when flights are disabled', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: false,
          adultCount: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.flightsAdultCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: false,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('does not select the flights adult-count follow-up when flights are unset', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: null,
          adultCount: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.flightsAdultCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: null,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('lets missing core travel fields beat the flights adult-count follow-up', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          flightsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          flightsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          flightsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);
  });

  it('lets the flights adult-count follow-up beat accommodation guest-count, activities, restaurants, and neutral continuation', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.flightsAdultCount);

    const selected = selectConversationFollowUpQuestion(
      completeCore({
        flightsRequested: true,
        accommodationRequested: true,
        activitiesRequested: true,
        restaurantsRequested: true,
        adultCount: null,
      }),
    );
    expect(selected).toBe(FOLLOW_UPS.flightsAdultCount);
    expect(selected).not.toBe(FOLLOW_UPS.accommodationGuestCount);
    expect(selected).not.toBe(FOLLOW_UPS.activities);
    expect(selected).not.toBe(FOLLOW_UPS.restaurants);
    expect(selected).not.toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the neutral continuation when flights adult-count is not pending and nothing else is pending', () => {
    expect(selectConversationFollowUpQuestion(completeCore())).toBe(
      FOLLOW_UPS.neutralContinuation,
    );

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          adultCount: 2,
          childCount: 2,
          infantCount: 1,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: false,
          adultCount: null,
          accommodationRequested: false,
          activitiesRequested: false,
          restaurantsRequested: false,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(FOLLOW_UPS.neutralContinuation).toBe(
      'What else should I know about your trip?',
    );
  });
});
