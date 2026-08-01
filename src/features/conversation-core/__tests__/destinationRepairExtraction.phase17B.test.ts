import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';

/**
 * Phase 17B — destination repair extraction.
 *
 * Root cause (17A): DestinationConversationStateExtractor had no "meant" /
 * "change that" / "make that" / "Actually," cues, and blanket \\bnot\\b blocked
 * contrast "Not Melbourne, Cairns". "Actually make it" already worked via a
 * separate cue; "Actually, Cairns" did not (comma form missing).
 */

const EXTRACTOR = new DestinationConversationStateExtractor();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17b',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function extractDestination(message: string): string | null {
  const result = EXTRACTOR.extract({
    message,
    currentState: createState({ destination: 'Melbourne' }),
  });
  return result.stateUpdate.destination ?? null;
}

function turn(
  message: string,
  seed: Partial<ConversationCoreState>,
  index = 0,
) {
  const previous = createState(seed);
  const extracted = COMPOSITE.extract({
    message,
    currentState: previous,
  });
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: `user-17b-${index}`,
    assistantEntryId: `assistant-17b-${index}`,
    userMessageAt: new Date(
      `2026-07-29T00:${String(index).padStart(2, '0')}:00.000Z`,
    ),
    assistantMessageAt: new Date(
      `2026-07-29T00:${String(index).padStart(2, '0')}:01.000Z`,
    ),
  });
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return { previous, extracted, result, classification, plan };
}

const REPAIR_FAMILIES = [
  'Sorry, I meant Cairns',
  'I meant Cairns',
  'Actually, Cairns',
  'No, make that Cairns',
  'Change that to Cairns',
  'Not Melbourne, Cairns',
] as const;

describe('Phase 17B — destination repair extraction', () => {
  it('extracts all six repair families as destination Cairns', () => {
    for (const message of REPAIR_FAMILIES) {
      expect(extractDestination(message), message).toBe('Cairns');
      expect(
        COMPOSITE.extract({
          message,
          currentState: createState({ destination: 'Melbourne' }),
        }).stateUpdate,
        message,
      ).toEqual({ destination: 'Cairns' });
    }
  });

  it('replaces an existing destination and sets a null destination', () => {
    for (const message of REPAIR_FAMILIES) {
      expect(
        EXTRACTOR.extract({
          message,
          currentState: createState({ destination: 'Melbourne' }),
        }).stateUpdate.destination,
        `replace:${message}`,
      ).toBe('Cairns');
      expect(
        EXTRACTOR.extract({
          message,
          currentState: createState({ destination: null }),
        }).stateUpdate.destination,
        `null:${message}`,
      ).toBe('Cairns');
    }
  });

  it('tolerates capitalisation and terminal punctuation on repair families', () => {
    const cases: Array<{ message: string; destination: string }> = [
      { message: 'sorry, i meant cairns', destination: 'cairns' },
      { message: 'SORRY, I MEANT CAIRNS', destination: 'CAIRNS' },
      { message: 'Sorry, I meant Cairns!', destination: 'Cairns' },
      { message: 'I meant Cairns.', destination: 'Cairns' },
      { message: 'Actually, Cairns!', destination: 'Cairns' },
      { message: 'No, make that Cairns.', destination: 'Cairns' },
      { message: 'Change that to Cairns!', destination: 'Cairns' },
      { message: 'Not Melbourne, Cairns.', destination: 'Cairns' },
      { message: 'not melbourne, cairns', destination: 'cairns' },
      {
        message: 'Change that to Hamilton Island!',
        destination: 'Hamilton Island',
      },
    ];
    for (const { message, destination } of cases) {
      expect(extractDestination(message), message).toBe(destination);
    }
  });

  it('contrast repair selects only the new destination, never the old', () => {
    expect(extractDestination('Not Melbourne, Cairns')).toBe('Cairns');
    expect(extractDestination('Not Melbourne, Cairns')).not.toBe('Melbourne');
    expect(extractDestination('Not Hobart, Gold Coast')).toBe('Gold Coast');
    expect(extractDestination('Not Hobart, Gold Coast')).not.toBe('Hobart');
  });

  it('does not misinterpret unrelated sentences containing repair vocabulary', () => {
    const negatives = [
      'Actually, I need a hotel in Cairns',
      'I meant that the hotel should be central',
      'Sorry, I meant accommodation, not flights',
      'Not sure about Cairns',
      'Change that to three adults',
      'No, make that two children',
      'Not Melbourne, keep Gold Coast',
      'I meant Cairns or Hobart',
      // Date-like meant phrases must not become destinations.
      'Sorry, I meant 30 August 2026',
      'Sorry, I meant Return on 20 August 2026',
    ];
    for (const message of negatives) {
      expect(
        EXTRACTOR.extract({
          message,
          currentState: createState({ destination: 'Melbourne' }),
        }).stateUpdate,
        message,
      ).toEqual({});
    }
  });

  it('preserves existing destination extraction cues', () => {
    const preserved = [
      { message: 'change it to Cairns', destination: 'Cairns' },
      { message: 'go to Cairns', destination: 'Cairns' },
      { message: 'Actually make it Cairns', destination: 'Cairns' },
      { message: 'destination is Cairns', destination: 'Cairns' },
    ];
    for (const { message, destination } of preserved) {
      expect(extractDestination(message), message).toBe(destination);
    }
  });

  it('end-to-end: Melbourne → Cairns is field-changed with Phase 16J wording', () => {
    const cases = [
      'Sorry, I meant Cairns',
      'I meant Cairns',
      'Actually, Cairns',
      'No, make that Cairns',
      'Change that to Cairns',
      'Not Melbourne, Cairns',
    ] as const;

    for (const [index, message] of cases.entries()) {
      const { extracted, result, classification, plan } = turn(
        message,
        {
          destination: 'Melbourne',
          origin: null,
        },
        index,
      );
      expect(extracted.stateUpdate, message).toEqual({ destination: 'Cairns' });
      expect(result.state.destination, message).toBe('Cairns');
      expect(classification.updated, message).toEqual(['destination']);
      expect(classification.newlyPopulated, message).toEqual([]);
      expect(plan.acknowledgementEvent, message).toEqual({
        kind: 'field-changed',
        field: 'destination',
      });
      expect(result.reply, message).toBe(
        `Updated — Cairns it is. ${FOLLOW_UPS.origin}`,
      );
      expect(plan.followUpQuestion, message).toBe(FOLLOW_UPS.origin);
    }
  });

  it('end-to-end: null → Cairns is field-set with Phase 16J wording', () => {
    const { extracted, result, classification, plan } = turn(
      'Sorry, I meant Cairns',
      { destination: null, origin: null },
      20,
    );
    expect(extracted.stateUpdate).toEqual({ destination: 'Cairns' });
    expect(result.state.destination).toBe('Cairns');
    expect(classification.newlyPopulated).toEqual(['destination']);
    expect(classification.updated).toEqual([]);
    expect(plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'destination',
    });
    expect(result.reply).toBe(`Great, Cairns it is. ${FOLLOW_UPS.origin}`);
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.origin);
  });

  it('end-to-end: populated trip repair uses field-changed + 16B bridge', () => {
    const { extracted, result, classification, plan } = turn(
      'Sorry, I meant Cairns',
      {
        destination: 'Melbourne',
        origin: 'Sydney',
        departureDate: '2026-08-10',
        returnDate: '2026-08-17',
        adultCount: 2,
      },
      30,
    );
    expect(extracted.stateUpdate).toEqual({ destination: 'Cairns' });
    expect(result.state.destination).toBe('Cairns');
    expect(classification.updated).toContain('destination');
    expect(plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(result.reply).toBe(
      "Updated — Cairns it is. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );
  });
});
