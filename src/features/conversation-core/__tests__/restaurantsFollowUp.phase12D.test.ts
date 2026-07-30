import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12D — restaurants follow-up characterisation.
 *
 * Locks the existing restaurants follow-up boundary and catalogue wording
 * before travel-consultant wording refinement. Does not change production
 * behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12d-restaurants-001';
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

describe('phase 12D — restaurants follow-up characterisation', () => {
  it('uses the exact catalogue restaurants follow-up wording', () => {
    expect(FOLLOW_UPS.restaurants).toBe(
      'What type of dining are you looking for?',
    );
  });

  it('selects the restaurants follow-up when restaurants are requested and higher-priority requirements are satisfied', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.restaurants);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.restaurants);
  });

  it('lets higher-priority missing travel requirements beat the restaurants follow-up', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          adultCount: null,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.flightsAdultCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: true,
          adultCount: null,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.accommodationGuestCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.activities);
  });

  it('does not select the restaurants follow-up when restaurants are disabled', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          restaurantsRequested: false,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.restaurants);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          restaurantsRequested: false,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('does not select the restaurants follow-up when restaurants are unset', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          restaurantsRequested: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.restaurants);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          restaurantsRequested: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the neutral continuation when restaurants are not pending and nothing else is pending', () => {
    expect(selectConversationFollowUpQuestion(completeCore())).toBe(
      FOLLOW_UPS.neutralContinuation,
    );

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
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
