import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15F — refine follow-up-only lead-in grammar.
 *
 * Proves lead-ins are complete sentences so capitalized follow-up questions
 * begin naturally, without modifying the questions themselves.
 */

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const MALFORMED_PATTERNS = [', Where', 'And When', ', How', ', What'] as const;

const EXACT_OUTPUTS: Array<{
  id: string;
  followUp: string;
  leadIn: string;
  expected: string;
}> = [
  {
    id: 'destination',
    followUp: FOLLOW_UPS.destination,
    leadIn: "Let's start with the destination.",
    expected: `Let's start with the destination. ${FOLLOW_UPS.destination}`,
  },
  {
    id: 'origin',
    followUp: FOLLOW_UPS.origin,
    leadIn: "Let's begin with where you're travelling from.",
    expected: `Let's begin with where you're travelling from. ${FOLLOW_UPS.origin}`,
  },
  {
    id: 'departureDate',
    followUp: FOLLOW_UPS.departureDate,
    leadIn: 'Now for the timing.',
    expected: `Now for the timing. ${FOLLOW_UPS.departureDate}`,
  },
  {
    id: 'returnDate',
    followUp: FOLLOW_UPS.returnDate,
    leadIn: 'And for your return.',
    expected: `And for your return. ${FOLLOW_UPS.returnDate}`,
  },
  {
    id: 'activities',
    followUp: FOLLOW_UPS.activities,
    leadIn: "Let's look at activities.",
    expected: `Let's look at activities. ${FOLLOW_UPS.activities}`,
  },
  {
    id: 'restaurants',
    followUp: FOLLOW_UPS.restaurants,
    leadIn: 'Now for dining.',
    expected: `Now for dining. ${FOLLOW_UPS.restaurants}`,
  },
];

/** Trip-wide passenger questions must not use service-scoped lead-ins. */
const TRIP_WIDE_PASSENGER_FOLLOW_UPS = [
  {
    id: 'flightsAdultCount',
    followUp: FOLLOW_UPS.flightsAdultCount,
  },
  {
    id: 'accommodationGuestCount',
    followUp: FOLLOW_UPS.accommodationGuestCount,
  },
] as const;

function plan(
  overrides: Partial<ConversationReplyPlan> = {},
): ConversationReplyPlan {
  return {
    acknowledgements: [],
    acknowledgementEvent: null,
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

function freezePlan(replyPlan: ConversationReplyPlan): ConversationReplyPlan {
  return Object.freeze({
    ...replyPlan,
    acknowledgements: Object.freeze([...replyPlan.acknowledgements]),
  });
}

describe('phase 15F — follow-up-only lead-in grammar', () => {
  it('omits service-scoped lead-ins for trip-wide passenger questions', () => {
    for (const entry of TRIP_WIDE_PASSENGER_FOLLOW_UPS) {
      const viaHelper = renderBaselineFollowUpOnly({
        followUpQuestion: entry.followUp,
      });
      expect(viaHelper, entry.id).toBe(entry.followUp);
      expect(viaHelper, `${entry.id} / no flights lead-in`).not.toMatch(
        /for the flights/i,
      );
      expect(viaHelper, `${entry.id} / no accommodation lead-in`).not.toMatch(
        /for the accommodation/i,
      );
    }
  });

  it('uses complete-sentence lead-ins and excludes malformed mid-sentence capitalization', () => {
    expect(EXACT_OUTPUTS).toHaveLength(6);

    for (const entry of EXACT_OUTPUTS) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [],
          followUpQuestion: entry.followUp,
          messageInterpreted: true,
        }),
      );
      const baseline = generateBaselineConversationalReply(replyPlan);
      const production = renderIntegratedConversationReplyPlan({
        plan: replyPlan,
      });
      const viaHelper = renderBaselineFollowUpOnly({
        followUpQuestion: entry.followUp,
      });

      expect(viaHelper, entry.id).toBe(entry.expected);
      expect(baseline, `${entry.id} / baseline`).toBe(entry.expected);
      expect(production, `${entry.id} / production`).toBe(entry.expected);
      expect(production, `${entry.id} / path agree`).toBe(baseline);

      expect(entry.leadIn.endsWith('.'), `${entry.id} / lead-in sentence`).toBe(
        true,
      );
      expect(baseline.startsWith(`${entry.leadIn} `), entry.id).toBe(true);
      expect(
        baseline.slice(entry.leadIn.length + 1),
        `${entry.id} / question after lead-in`,
      ).toBe(entry.followUp);
      expect(
        baseline.slice(baseline.length - entry.followUp.length),
        `${entry.id} / byte-identical question`,
      ).toBe(entry.followUp);

      for (const pattern of MALFORMED_PATTERNS) {
        expect(
          baseline.includes(pattern),
          `${entry.id} must not contain ${pattern}`,
        ).toBe(false);
      }
    }
  });

  it('keeps unknown, neutral, Phase 15B, and Phase 15C behaviour unchanged', () => {
    const unknown = 'Would you like a window seat preference noted?';
    expect(renderBaselineFollowUpOnly({ followUpQuestion: unknown })).toBe(
      unknown,
    );
    expect(
      generateBaselineConversationalReply(
        freezePlan(
          plan({
            acknowledgements: [],
      acknowledgementEvent: null,
            followUpQuestion: unknown,
            messageInterpreted: true,
          }),
        ),
      ),
    ).toBe(unknown);

    const neutralPlan = freezePlan(
      plan({
        acknowledgements: [],
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(neutralPlan)).toBe(
      ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
    );
    expect(renderConversationReplyPlan(neutralPlan)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );

    const acknowledgementOnly = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
      acknowledgementEvent: null,
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(acknowledgementOnly)).toBe(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')),
    );

    const acknowledgementPlusFollowUp = freezePlan(
      plan({
        acknowledgements: [ACKS.origin('Sydney')],
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    expect(
      generateBaselineConversationalReply(acknowledgementPlusFollowUp),
    ).toBe(expectedActivatedBaselineReply(acknowledgementPlusFollowUp));
    expect(
      generateBaselineConversationalReply(acknowledgementPlusFollowUp),
    ).toBe(
      `${transformBaselineAcknowledgement(ACKS.origin('Sydney'))} ${FOLLOW_UPS.departureDate}`,
    );
  });
});
