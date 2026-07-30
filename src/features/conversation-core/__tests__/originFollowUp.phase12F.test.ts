import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12F — origin follow-up characterisation.
 *
 * Locks the existing origin follow-up boundary and catalogue wording before
 * travel-consultant wording refinement. Does not change production behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12f-origin-001';
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

describe('phase 12F — origin follow-up characterisation', () => {
  it('uses the exact catalogue origin follow-up wording', () => {
    expect(FOLLOW_UPS.origin).toBe('Where will you be travelling from?');
  });

  it('selects the origin follow-up when destination is supplied and origin is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);
  });

  it('skips the origin follow-up when origin is supplied', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
        }),
      ),
    ).not.toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);
  });

  it('selects the origin follow-up again when origin is explicitly removed', () => {
    const withOrigin = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });
    expect(selectConversationFollowUpQuestion(withOrigin)).not.toBe(
      FOLLOW_UPS.origin,
    );

    const afterRemoval = {
      ...withOrigin,
      origin: null,
    };
    expect(selectConversationFollowUpQuestion(afterRemoval)).toBe(
      FOLLOW_UPS.origin,
    );
  });

  it('lets the destination follow-up beat origin when destination is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          origin: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: null,
          origin: null,
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
          origin: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.origin);
  });

  it('lets the origin follow-up beat dates, service-specific follow-ups, and neutral continuation', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    const selected = selectConversationFollowUpQuestion(
      createState({
        destination: 'Cairns',
        origin: null,
        departureDate: null,
        returnDate: null,
        flightsRequested: true,
        accommodationRequested: true,
        activitiesRequested: true,
        restaurantsRequested: true,
      }),
    );
    expect(selected).toBe(FOLLOW_UPS.origin);
    expect(selected).not.toBe(FOLLOW_UPS.departureDate);
    expect(selected).not.toBe(FOLLOW_UPS.returnDate);
    expect(selected).not.toBe(FOLLOW_UPS.flightsAdultCount);
    expect(selected).not.toBe(FOLLOW_UPS.accommodationGuestCount);
    expect(selected).not.toBe(FOLLOW_UPS.activities);
    expect(selected).not.toBe(FOLLOW_UPS.restaurants);
    expect(selected).not.toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the neutral continuation when origin is not pending and nothing else is pending', () => {
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
