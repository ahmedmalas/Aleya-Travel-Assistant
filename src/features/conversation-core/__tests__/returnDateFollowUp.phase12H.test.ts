import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12H — return-date follow-up characterisation.
 *
 * Locks the existing return-date follow-up boundary and catalogue wording
 * before travel-consultant wording refinement. Does not change production
 * behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12h-return-date-001';
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

describe('phase 12H — return-date follow-up characterisation', () => {
  it('uses the exact catalogue return-date follow-up wording', () => {
    expect(FOLLOW_UPS.returnDate).toBe('When would you like to return?');
  });

  it('selects the return-date follow-up when destination, origin, and departureDate are supplied and returnDate is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);
  });

  it('skips the return-date follow-up when returnDate is supplied', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        }),
      ),
    ).not.toBe(FOLLOW_UPS.returnDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the return-date follow-up again when returnDate is explicitly removed', () => {
    const withReturnDate = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });
    expect(selectConversationFollowUpQuestion(withReturnDate)).not.toBe(
      FOLLOW_UPS.returnDate,
    );

    const afterRemoval = {
      ...withReturnDate,
      returnDate: null,
    };
    expect(selectConversationFollowUpQuestion(afterRemoval)).toBe(
      FOLLOW_UPS.returnDate,
    );
  });

  it('lets the destination follow-up beat return date when destination is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: null,
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: null,
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: null,
          flightsRequested: true,
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
          departureDate: '2026-08-28',
          returnDate: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.returnDate);
  });

  it('lets the origin follow-up beat return date when origin is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: null,
          departureDate: '2026-08-28',
          returnDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: null,
          departureDate: '2026-08-28',
          returnDate: null,
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
          departureDate: '2026-08-28',
          returnDate: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.returnDate);
  });

  it('lets the departure-date follow-up beat return date when departureDate is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: null,
          returnDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    expect(
      selectConversationFollowUpQuestion(
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
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: null,
          returnDate: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.returnDate);
  });

  it('lets the return-date follow-up beat flights, accommodation, activities, restaurants, and neutral continuation', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);

    const selected = selectConversationFollowUpQuestion(
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: null,
        flightsRequested: true,
        accommodationRequested: true,
        activitiesRequested: true,
        restaurantsRequested: true,
      }),
    );
    expect(selected).toBe(FOLLOW_UPS.returnDate);
    expect(selected).not.toBe(FOLLOW_UPS.flightsAdultCount);
    expect(selected).not.toBe(FOLLOW_UPS.accommodationGuestCount);
    expect(selected).not.toBe(FOLLOW_UPS.activities);
    expect(selected).not.toBe(FOLLOW_UPS.restaurants);
    expect(selected).not.toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the neutral continuation when return date is not pending and nothing else is pending', () => {
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
