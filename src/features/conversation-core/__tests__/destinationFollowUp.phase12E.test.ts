import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12E — destination follow-up characterisation.
 *
 * Locks the existing destination follow-up boundary and catalogue wording
 * before travel-consultant wording refinement. Does not change production
 * behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12e-destination-001';
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

describe('phase 12E — destination follow-up characterisation', () => {
  it('uses the exact catalogue destination follow-up wording', () => {
    expect(FOLLOW_UPS.destination).toBe('Where would you like to travel?');
  });

  it('selects the destination follow-up when destination is missing', () => {
    expect(selectConversationFollowUpQuestion(createState())).toBe(
      FOLLOW_UPS.destination,
    );

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);
  });

  it('skips the destination follow-up when destination is supplied', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
        }),
      ),
    ).not.toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);
  });

  it('selects the destination follow-up again when destination is explicitly removed', () => {
    const withDestination = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });
    expect(selectConversationFollowUpQuestion(withDestination)).not.toBe(
      FOLLOW_UPS.destination,
    );

    const afterRemoval = {
      ...withDestination,
      destination: null,
    };
    expect(selectConversationFollowUpQuestion(afterRemoval)).toBe(
      FOLLOW_UPS.destination,
    );
  });

  it('lets the destination follow-up beat every lower-priority follow-up', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          origin: null,
          departureDate: null,
          returnDate: null,
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    const selected = selectConversationFollowUpQuestion(
      createState({
        flightsRequested: true,
        accommodationRequested: true,
        activitiesRequested: true,
        restaurantsRequested: true,
      }),
    );
    expect(selected).toBe(FOLLOW_UPS.destination);
    expect(selected).not.toBe(FOLLOW_UPS.origin);
    expect(selected).not.toBe(FOLLOW_UPS.departureDate);
    expect(selected).not.toBe(FOLLOW_UPS.returnDate);
    expect(selected).not.toBe(FOLLOW_UPS.flightsAdultCount);
    expect(selected).not.toBe(FOLLOW_UPS.accommodationGuestCount);
    expect(selected).not.toBe(FOLLOW_UPS.activities);
    expect(selected).not.toBe(FOLLOW_UPS.restaurants);
    expect(selected).not.toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the neutral continuation when destination is not pending and nothing else is pending', () => {
    expect(selectConversationFollowUpQuestion(completeCore())).toBe(
      FOLLOW_UPS.neutralContinuation,
    );

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          flightsRequested: false,
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
