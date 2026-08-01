import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12G — departure-date follow-up characterisation.
 *
 * Locks the existing departure-date follow-up boundary and catalogue wording
 * before travel-consultant wording refinement. Does not change production
 * behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12g-departure-date-001';
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

describe('phase 12G — departure-date follow-up characterisation', () => {
  it('uses the exact catalogue departure-date follow-up wording', () => {
    expect(FOLLOW_UPS.departureDate).toBe('When would you like to depart?');
  });

  it('selects the departure-date follow-up when destination and origin are supplied and departureDate is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);
  });

  it('skips the departure-date follow-up when departureDate is supplied', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      ),
    ).not.toBe(FOLLOW_UPS.departureDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);
  });

  it('selects the departure-date follow-up again when departureDate is explicitly removed', () => {
    const withDepartureDate = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });
    expect(selectConversationFollowUpQuestion(withDepartureDate)).not.toBe(
      FOLLOW_UPS.departureDate,
    );

    const afterRemoval = {
      ...withDepartureDate,
      departureDate: null,
    };
    expect(selectConversationFollowUpQuestion(afterRemoval)).toBe(
      FOLLOW_UPS.departureDate,
    );
  });

  it('lets the destination follow-up beat departure date when destination is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: null,
          origin: 'Sydney',
          departureDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: null,
          origin: 'Sydney',
          departureDate: null,
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: null,
          origin: 'Sydney',
          departureDate: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.departureDate);
  });

  it('lets the origin follow-up beat departure date when origin is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: null,
          departureDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: null,
          departureDate: null,
          flightsRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: null,
          departureDate: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.departureDate);
  });

  it('lets the departure-date follow-up beat return date, service-specific follow-ups, and neutral continuation', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    const selected = selectConversationFollowUpQuestion(
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: null,
        returnDate: null,
        flightsRequested: true,
        accommodationRequested: true,
        activitiesRequested: true,
        restaurantsRequested: true,
      }),
    );
    expect(selected).toBe(FOLLOW_UPS.departureDate);
    expect(selected).not.toBe(FOLLOW_UPS.returnDate);
    expect(selected).not.toBe(FOLLOW_UPS.flightsAdultCount);
    expect(selected).not.toBe(FOLLOW_UPS.accommodationGuestCount);
    expect(selected).not.toBe(FOLLOW_UPS.activities);
    expect(selected).not.toBe(FOLLOW_UPS.restaurants);
    expect(selected).not.toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the neutral continuation when departure date is not pending and nothing else is pending', () => {
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
