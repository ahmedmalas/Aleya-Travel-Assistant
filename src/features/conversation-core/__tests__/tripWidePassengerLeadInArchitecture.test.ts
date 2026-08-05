import { describe, expect, it } from 'vitest';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
} from '../index';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;

describe('Trip-wide passenger question context architecture', () => {
  it('does not frame adult/guest follow-ups as flight-only or accommodation-only', () => {
    const adult = renderBaselineFollowUpOnly({
      followUpQuestion: F.flightsAdultCount,
    });
    const guest = renderBaselineFollowUpOnly({
      followUpQuestion: F.accommodationGuestCount,
    });

    expect(adult).toBe(F.flightsAdultCount);
    expect(guest).toBe(F.accommodationGuestCount);
    expect(adult).not.toMatch(/for the flights/i);
    expect(guest).not.toMatch(/for the accommodation/i);
  });

  it('preserves deterministic passenger progression without service-scoped lead-ins', () => {
    const afterDates = {
      ...createInitialConversationCoreState({
        conversationId: 'trip-wide-passengers',
        now: new Date('2026-08-04T00:00:00.000Z'),
      }),
      status: 'active' as const,
      turnCount: 2,
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-08-31',
      destinationResolutionStatus: 'resolved' as const,
      originResolutionStatus: 'resolved' as const,
      flightsRequested: true,
      accommodationRequested: false,
      adultCount: null,
      childCount: null,
      infantCount: null,
    };

    expect(selectConversationFollowUpQuestion(afterDates)).toBe(
      F.flightsAdultCount,
    );

    const result = processConversationTurn({
      message: 'flights please',
      state: {
        ...afterDates,
        flightsRequested: null,
      },
      userEntryId: 'u-1',
      assistantEntryId: 'a-1',
      userMessageAt: new Date('2026-08-04T00:00:00.000Z'),
      assistantMessageAt: new Date('2026-08-04T00:00:01.000Z'),
      stateUpdate: { flightsRequested: true },
      skipExtraction: true,
    });

    expect(result.reply).toContain(F.flightsAdultCount);
    expect(result.reply).not.toMatch(/for the flights/i);
    expect(result.reply).not.toMatch(/for the accommodation/i);
  });
});
