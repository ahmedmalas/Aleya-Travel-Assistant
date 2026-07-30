import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12B — accommodation guest-count follow-up characterisation.
 *
 * Locks the existing accommodation guest-count follow-up behaviour and
 * catalogue wording before travel-consultant wording refinement. Does not
 * change production behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12b-accommodation-guest-001';
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

describe('phase 12B — accommodation guest-count follow-up characterisation', () => {
  it('uses the exact catalogue accommodation guest-count wording', () => {
    expect(FOLLOW_UPS.accommodationGuestCount).toBe(
      'How many guests will be staying?',
    );
  });

  it('selects the accommodation guest-count follow-up when accommodation is requested and adult count is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.accommodationGuestCount);
  });

  it('does not select the accommodation guest-count follow-up when adult count is supplied', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: true,
          adultCount: 2,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.accommodationGuestCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: true,
          adultCount: 2,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('lets higher-priority missing travel requirements win before accommodation', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          accommodationRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.destination);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          accommodationRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          accommodationRequested: true,
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
          accommodationRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          accommodationRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.flightsAdultCount);
  });

  it('does not select the accommodation guest-count follow-up when accommodation is disabled or unset', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: false,
          adultCount: null,
        }),
      ),
    ).not.toBe(FOLLOW_UPS.accommodationGuestCount);

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
    ).not.toBe(FOLLOW_UPS.accommodationGuestCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: null,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });
});
