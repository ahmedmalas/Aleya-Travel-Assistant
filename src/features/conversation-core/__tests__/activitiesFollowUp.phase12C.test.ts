import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12C — activities follow-up characterisation.
 *
 * Locks the existing activities follow-up boundary and catalogue wording
 * before travel-consultant wording refinement. Does not change production
 * behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12c-activities-001';
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

describe('phase 12C — activities follow-up characterisation', () => {
  it('uses the exact catalogue activities follow-up wording', () => {
    expect(FOLLOW_UPS.activities).toBe(
      'What kinds of activities are you interested in?',
    );
  });

  it('selects the activities follow-up when activities are requested and higher-priority requirements are satisfied', () => {
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
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.activities);
  });

  it('lets higher-priority missing travel requirements beat the activities follow-up', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          adultCount: null,
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.flightsAdultCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: true,
          adultCount: null,
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.accommodationGuestCount);
  });

  it('does not select the activities follow-up when activities are disabled', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: false,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.activities);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: false,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('does not select the activities follow-up when activities are unset', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.activities);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the neutral continuation when activities are not pending and nothing else is pending', () => {
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
