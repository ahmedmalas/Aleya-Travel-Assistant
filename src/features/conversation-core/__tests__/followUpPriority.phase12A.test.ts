import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import {
  CONVERSATION_REPLY_CATALOGUE,
  NEUTRAL_TRIP_FALLBACK_REPLY,
} from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12A — follow-up priority characterisation.
 *
 * Locks the complete existing follow-up-question priority and catalogue wording
 * before travel-consultant wording refinement. Does not change production
 * behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12a-follow-up-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const PRIORITY_ORDER = [
  FOLLOW_UPS.destination,
  FOLLOW_UPS.origin,
  FOLLOW_UPS.departureDate,
  FOLLOW_UPS.returnDate,
  FOLLOW_UPS.flightsAdultCount,
  FOLLOW_UPS.accommodationGuestCount,
  FOLLOW_UPS.activities,
  FOLLOW_UPS.restaurants,
  FOLLOW_UPS.neutralContinuation,
] as const;

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

describe('phase 12A — follow-up priority characterisation', () => {
  it('documents the current follow-up priority order', () => {
    expect(PRIORITY_ORDER).toEqual([
      'Where would you like to travel?',
      'Where will you be travelling from?',
      'When would you like to depart?',
      'When would you like to return?',
      'How many adults will be travelling?',
      'How many guests will be staying?',
      'What kinds of activities are you interested in?',
      'What type of dining are you looking for?',
      'What else should I know about your trip?',
    ]);
    expect(NEUTRAL_TRIP_FALLBACK_REPLY).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects each follow-up when it is the highest missing requirement', () => {
    expect(selectConversationFollowUpQuestion(createState())).toBe(
      FOLLOW_UPS.destination,
    );

    expect(
      selectConversationFollowUpQuestion(
        createState({ destination: 'Cairns' }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({ destination: 'Cairns', origin: 'Sydney' }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

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
        completeCore({
          flightsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.flightsAdultCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.accommodationGuestCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.activities);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.restaurants);
  });

  it('lets each higher-priority missing requirement beat every lower-priority requirement', () => {
    // destination beats everything below
    expect(
      selectConversationFollowUpQuestion(
        createState({
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    // origin beats dates and contextual
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          flightsRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    // departureDate beats returnDate and contextual
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    // returnDate beats contextual
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
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);

    // flights adult-count beats accommodation guest-count, activities, restaurants
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

    // accommodation guest-count beats activities and restaurants
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: false,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.accommodationGuestCount);

    // activities beats restaurants
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

  it('skips completed requirements and continues to the next eligible follow-up', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          flightsRequested: true,
          adultCount: 2,
          childCount: 2,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          accommodationRequested: true,
          adultCount: 2,
          childCount: 2,
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.activities);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          adultCount: 2,
          childCount: 2,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.restaurants);
  });

  it('does not trigger service-specific follow-ups when the service is disabled or unset', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: false,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: null,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: false,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: null,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: false,
          restaurantsRequested: false,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: null,
          restaurantsRequested: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('returns the neutral continuation when no specific follow-up requirement remains', () => {
    // Current production terminal: catalogue neutral continuation (not null).
    const selected = selectConversationFollowUpQuestion(completeCore());
    expect(selected).toBe(FOLLOW_UPS.neutralContinuation);
    expect(selected).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(selected).not.toBeNull();
    expect(PRIORITY_ORDER.slice(0, -1)).not.toContain(selected);
  });

  it('selects at most one follow-up question', () => {
    const selected = selectConversationFollowUpQuestion(
      createState({
        flightsRequested: true,
        accommodationRequested: true,
        activitiesRequested: true,
        restaurantsRequested: true,
      }),
    );
    expect(selected).toBe(FOLLOW_UPS.destination);
    expect(typeof selected).toBe('string');
    expect(selected!.includes('\n')).toBe(false);

    const contextual = selectConversationFollowUpQuestion(
      completeCore({
        flightsRequested: true,
        accommodationRequested: true,
        activitiesRequested: true,
        restaurantsRequested: true,
        adultCount: null,
      }),
    );
    expect(contextual).toBe(FOLLOW_UPS.flightsAdultCount);
    expect(contextual!.includes('\n')).toBe(false);
  });
});
