import { describe, expect, it } from 'vitest';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16F — distinguish infant acknowledgement opener from child.
 *
 * Proves infant openers use "That includes" while child / adult / mixed-field
 * Phase 16D wording remain unchanged. Includes production-path coverage.
 */

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16f',
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
    userEntryId: 'user-16f',
    assistantEntryId: 'assistant-16f',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
  });
}

function openerHead(reply: string): string {
  if (reply.startsWith('Travelling with')) return 'Travelling with';
  if (reply.startsWith("I've noted")) return "I've noted";
  if (reply.startsWith('That includes')) return 'That includes';
  if (reply.startsWith('Great,')) return 'Great,';
  if (reply.startsWith("We'll start")) return "We'll start";
  if (reply.startsWith('Departure is set')) return 'Departure is set';
  if (reply.startsWith('Return is set')) return 'Return is set';
  return reply.split(/[\s.]/)[0] ?? '';
}

describe('phase 16F — distinguish infant acknowledgement opener', () => {
  it('transforms infant singular and plural to That includes', () => {
    expect(transformBaselineAcknowledgement(ACKS.infantCount(1))).toBe(
      'That includes 1 infant.',
    );
    expect(transformBaselineAcknowledgement(ACKS.infantCount(2))).toBe(
      'That includes 2 infants.',
    );
  });

  it('keeps child, adult, and unknown transformations unchanged', () => {
    expect(transformBaselineAcknowledgement(ACKS.childCount(1))).toBe(
      "I've noted 1 child.",
    );
    expect(transformBaselineAcknowledgement(ACKS.childCount(3))).toBe(
      "I've noted 3 children.",
    );
    expect(transformBaselineAcknowledgement(ACKS.adultCount(1))).toBe(
      'Travelling with 1 adult.',
    );
    expect(transformBaselineAcknowledgement(ACKS.adultCount(2))).toBe(
      'Travelling with 2 adults.',
    );
    expect(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')),
    ).toBe('Great, Cairns it is.');
    expect(transformBaselineAcknowledgement(ACKS.origin('Sydney'))).toBe(
      "We'll start from Sydney.",
    );
    expect(
      transformBaselineAcknowledgement(ACKS.departureDate('2026-08-28')),
    ).toBe('Departure is set for 2026-08-28.');
    expect(
      transformBaselineAcknowledgement(ACKS.returnDate('2026-09-05')),
    ).toBe('Return is set for 2026-09-05.');
    expect(transformBaselineAcknowledgement(ACKS.destinationRemoved)).toBe(
      "No problem, I've removed the destination.",
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

  it('proves child followed by infant has distinct openers on the production path', () => {
    let state = createState();
    const replies: string[] = [];
    for (const message of [
      'go to Cairns',
      'from Sydney',
      'Depart on 28 August 2026',
      'Return on 5 September 2026',
      '2 adults',
      '1 child',
      '1 infant',
    ]) {
      const result = turn(message, state);
      replies.push(result.reply);
      state = result.state;
    }

    expect(replies.map(openerHead)).toEqual([
      'Great,',
      "We'll start",
      'Departure is set',
      'Return is set',
      'Travelling with',
      "I've noted",
      'That includes',
    ]);

    expect(replies[4]).toContain('Travelling with 2 adults.');
    expect(replies[5]).toContain("I've noted 1 child.");
    expect(replies[6]).toContain('That includes 1 infant.');
    expect(replies[5]).not.toContain('That includes');
    expect(replies[6]).not.toContain("I've noted");

    // Prior cross-family I've noted → I've noted streak is gone.
    expect(openerHead(replies[5]!)).not.toBe(openerHead(replies[6]!));
  });

  it('preserves the Phase 16D mixed-field opener sequence through adults', () => {
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

    expect(replies.map(openerHead)).toEqual([
      'Great,',
      "We'll start",
      'Departure is set',
      'Return is set',
      'Travelling with',
    ]);
  });
});
