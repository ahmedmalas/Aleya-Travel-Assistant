import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { renderBaselineAcknowledgementNeutralContinuation } from '../renderBaselineAcknowledgementNeutralContinuation';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
} from '../renderBaselineNeutralContinuation';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16D — refine stateless acknowledgement openers.
 *
 * Proves exact family transforms, unchanged families, consumer propagation
 * across 15B/15C/16B, and production multi-turn opener diversification.
 */

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const EXACT_TRANSFORMS: Array<{
  label: string;
  acknowledgement: string;
  expected: string;
}> = [
  {
    label: 'destination set/change',
    acknowledgement: ACKS.destination('Cairns'),
    expected: 'Great, Cairns it is.',
  },
  {
    label: 'destination changed',
    acknowledgement: ACKS.destination('Hobart'),
    expected: 'Great, Hobart it is.',
  },
  {
    label: 'origin set/change',
    acknowledgement: ACKS.origin('Sydney'),
    expected: "We'll start from Sydney.",
  },
  {
    label: 'departure date set/change',
    acknowledgement: ACKS.departureDate('2026-08-28'),
    expected: 'Departure is set for 2026-08-28.',
  },
  {
    label: 'return date set/change',
    acknowledgement: ACKS.returnDate('2026-09-05'),
    expected: 'Return is set for 2026-09-05.',
  },
  {
    label: 'adult singular',
    acknowledgement: ACKS.adultCount(1),
    expected: 'Travelling with 1 adult.',
  },
  {
    label: 'adult plural',
    acknowledgement: ACKS.adultCount(2),
    expected: 'Travelling with 2 adults.',
  },
  {
    label: 'child singular',
    acknowledgement: ACKS.childCount(1),
    expected: "I've noted 1 child.",
  },
  {
    label: 'child plural',
    acknowledgement: ACKS.childCount(3),
    expected: "I've noted 3 children.",
  },
  {
    label: 'infant singular',
    acknowledgement: ACKS.infantCount(1),
    // Phase 16F supersedes prior I've noted infant wording.
    expected: 'That includes 1 infant.',
  },
  {
    label: 'infant plural',
    acknowledgement: ACKS.infantCount(2),
    expected: 'That includes 2 infants.',
  },
];

function plan(
  overrides: Partial<ConversationReplyPlan> = {},
): ConversationReplyPlan {
  return {
    acknowledgements: [],
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16d',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(message: string, state: ConversationCoreState) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-16d',
    assistantEntryId: 'assistant-16d',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
  });
}

function openingHead(reply: string): string {
  if (reply.startsWith('Great,')) return 'Great,';
  if (reply.startsWith("We'll start")) return "We'll start";
  if (reply.startsWith('Departure is set')) return 'Departure is set';
  if (reply.startsWith('Return is set')) return 'Return is set';
  if (reply.startsWith('Travelling with')) return 'Travelling with';
  if (reply.startsWith("I've noted")) return "I've noted";
  if (reply.startsWith('Perfect,')) return 'Perfect,';
  if (reply.startsWith('No problem,')) return 'No problem,';
  return reply.split(/[\s.]/)[0] ?? '';
}

describe('phase 16D — refine stateless acknowledgement openers', () => {
  it('applies exact opener refinements for destination, origin, dates, and passengers', () => {
    for (const entry of EXACT_TRANSFORMS) {
      expect(
        transformBaselineAcknowledgement(entry.acknowledgement),
        entry.label,
      ).toBe(entry.expected);
    }
  });

  it('leaves removals, capabilities, generic, and unknown transformations unchanged', () => {
    expect(transformBaselineAcknowledgement(ACKS.destinationRemoved)).toBe(
      "No problem, I've removed the destination.",
    );
    expect(transformBaselineAcknowledgement(ACKS.originRemoved)).toBe(
      "No problem, I've removed the departure location.",
    );
    expect(transformBaselineAcknowledgement(ACKS.departureDateRemoved)).toBe(
      "No problem, I've removed the departure date.",
    );
    expect(transformBaselineAcknowledgement(ACKS.returnDateRemoved)).toBe(
      "No problem, I've removed the return date.",
    );
    expect(transformBaselineAcknowledgement(ACKS.adultCountRemoved)).toBe(
      "No problem, I've removed the adult count.",
    );
    expect(transformBaselineAcknowledgement(ACKS.childCountRemoved)).toBe(
      "No problem, I've removed the child count.",
    );
    expect(transformBaselineAcknowledgement(ACKS.infantCountRemoved)).toBe(
      "No problem, I've removed the infant count.",
    );

    expect(
      transformBaselineAcknowledgement(ACKS.addedCapabilities('flights')),
    ).toBe("Great, I've added flights to your trip.");
    expect(
      transformBaselineAcknowledgement(ACKS.removedCapabilities('flights')),
    ).toBe("No problem, I've removed flights from your trip.");

    expect(
      transformBaselineAcknowledgement(ACKS.genericTravelFieldChange),
    ).toBe('Perfect, got it.');

    expect(
      transformBaselineAcknowledgement('Thanks for that travel note.'),
    ).toBe('Thanks for that travel note.');
  });

  it('propagates refined acknowledgements through 15B, 15C, and 16B consumers', () => {
    // 15B — acknowledgement-only
    const ackOnly = plan({
      acknowledgements: [ACKS.origin('Sydney')],
      followUpQuestion: null,
      messageInterpreted: true,
    });
    expect(generateBaselineConversationalReply(ackOnly)).toBe(
      "We'll start from Sydney.",
    );

    // 15C — acknowledgement + specific follow-up (follow-up byte-identical)
    const specific = FOLLOW_UPS.departureDate;
    expect(
      renderBaselineAcknowledgementFollowUp({
        acknowledgement: ACKS.origin('Sydney'),
        followUpQuestion: specific,
      }),
    ).toBe(`We'll start from Sydney. ${specific}`);
    expect(
      generateBaselineConversationalReply(
        plan({
          acknowledgements: [ACKS.origin('Sydney')],
          followUpQuestion: specific,
          messageInterpreted: true,
        }),
      ),
    ).toBe(`We'll start from Sydney. ${specific}`);
    expect(
      generateBaselineConversationalReply(
        plan({
          acknowledgements: [ACKS.origin('Sydney')],
          followUpQuestion: specific,
          messageInterpreted: true,
        }),
      ).endsWith(specific),
    ).toBe(true);

    // 16B — refined ack + exact bridge + byte-identical canonical neutral
    const bridge =
      "Is there anything else you'd like me to consider?";
    const sixteenB = renderBaselineAcknowledgementNeutralContinuation({
      acknowledgement: ACKS.returnDate('2026-09-05'),
      followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
    });
    expect(sixteenB).toBe(
      `Return is set for 2026-09-05. ${bridge} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`,
    );
    expect(sixteenB.endsWith(CANONICAL_NEUTRAL_CONTINUATION_PROMPT)).toBe(true);
    expect(
      sixteenB.slice(
        sixteenB.length - CANONICAL_NEUTRAL_CONTINUATION_PROMPT.length,
      ),
    ).toBe(CANONICAL_NEUTRAL_CONTINUATION_PROMPT);

    // 15J unchanged
    expect(
      generateBaselineConversationalReply(
        plan({
          acknowledgements: [],
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: false,
        }),
      ),
    ).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);

    // 15F unchanged
    expect(
      generateBaselineConversationalReply(
        plan({
          acknowledgements: [],
          followUpQuestion: FOLLOW_UPS.activities,
          messageInterpreted: true,
        }),
      ),
    ).toBe(
      renderBaselineFollowUpOnly({
        followUpQuestion: FOLLOW_UPS.activities,
      }),
    );

    // Deterministic fallback unchanged for multi-ack
    const multi = plan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    });
    expect(generateBaselineConversationalReply(multi)).toBe(
      renderConversationReplyPlan(multi),
    );

    const empty = plan();
    expect(generateBaselineConversationalReply(empty)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
  });

  it('breaks the Phase 16C four-turn Perfect, streak on the production path', () => {
    let state = createState();
    const replies: string[] = [];
    for (const message of [
      'I want to go to Cairns',
      'flying from Sydney',
      'Depart on 28 August 2026',
      'Return on 5 September 2026',
      '2 adults',
    ]) {
      const result = turn(message, state);
      replies.push(result.reply);
      state = result.state;
    }

    expect(replies.map(openingHead)).toEqual([
      'Great,',
      "We'll start",
      'Departure is set',
      'Return is set',
      'Travelling with',
    ]);

    expect(replies).toEqual([
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      'Departure is set for 2026-08-28. When would you like to return?',
      "Return is set for 2026-09-05. Is there anything else you'd like me to consider? What else should I know about your trip?",
      "Travelling with 2 adults. Is there anything else you'd like me to consider? What else should I know about your trip?",
    ]);

    for (const reply of replies) {
      expect(reply.includes('\n')).toBe(false);
      expect(reply.includes('  ')).toBe(false);
    }

    expect(replies[1]).toContain('Sydney');
    expect(replies[2]).toContain('2026-08-28');
    expect(replies[3]).toContain('2026-09-05');
    expect(replies[4]).toContain('2 adults');

    // No duplicate acknowledgement / follow-up substrings.
    expect(replies[0].split('Great, Cairns it is.').length - 1).toBe(1);
    expect(replies[0].split(FOLLOW_UPS.origin).length - 1).toBe(1);
    expect(
      replies[3].split(CANONICAL_NEUTRAL_CONTINUATION_PROMPT).length - 1,
    ).toBe(1);

    // Prior Phase 16C repetitive Perfect, streak is gone.
    expect(
      replies.every((reply) => !reply.startsWith('Perfect,')),
    ).toBe(true);
    expect(state).toMatchObject({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
    });
  });
});
