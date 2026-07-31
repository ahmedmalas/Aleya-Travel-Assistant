import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

/**
 * Phase 17C — origin repair extraction.
 *
 * Ownership rule:
 *   bare place repair → destination-owned (17B)
 *   explicit origin cue (from / origin / departure location) → origin-owned
 *
 * Root cause: origin lacked change-the-origin / departure-location repair cues;
 * "meant from" already hit \\bfrom\\s+ but destination repair also captured
 * "from Brisbane" until the Phase 17C collision guard.
 */

const ORIGIN = new OriginConversationStateExtractor();
const DESTINATION = new DestinationConversationStateExtractor();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17c',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

const ORIGIN_REPAIR_FAMILIES = [
  'Sorry, I meant from Brisbane',
  'I meant from Brisbane',
  'Actually, from Brisbane',
  'No, make that from Brisbane',
  'Change that to departing from Brisbane',
  'Change the origin to Brisbane',
  'Change the departure location to Brisbane',
  'From Brisbane instead',
  'Departing from Brisbane instead',
] as const;

function extractOrigin(message: string): string | null {
  return (
    ORIGIN.extract({
      message,
      currentState: createState({
        destination: 'Cairns',
        origin: 'Sydney',
      }),
    }).stateUpdate.origin ?? null
  );
}

function turn(
  message: string,
  seed: Partial<ConversationCoreState>,
  index = 0,
) {
  const previous = createState(seed);
  const extracted = COMPOSITE.extract({ message, currentState: previous });
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: `user-17c-${index}`,
    assistantEntryId: `assistant-17c-${index}`,
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

describe('Phase 17C — origin repair extraction', () => {
  it('extracts all explicit origin repair families as origin Brisbane', () => {
    for (const message of ORIGIN_REPAIR_FAMILIES) {
      expect(extractOrigin(message), message).toBe('Brisbane');
      expect(
        COMPOSITE.extract({
          message,
          currentState: createState({
            destination: 'Cairns',
            origin: 'Sydney',
          }),
        }).stateUpdate,
        message,
      ).toEqual({ origin: 'Brisbane' });
    }
  });

  it('replaces an existing origin and sets a null origin', () => {
    for (const message of ORIGIN_REPAIR_FAMILIES) {
      expect(
        ORIGIN.extract({
          message,
          currentState: createState({
            destination: 'Cairns',
            origin: 'Sydney',
          }),
        }).stateUpdate.origin,
        `replace:${message}`,
      ).toBe('Brisbane');
      expect(
        ORIGIN.extract({
          message,
          currentState: createState({
            destination: 'Cairns',
            origin: null,
          }),
        }).stateUpdate.origin,
        `null:${message}`,
      ).toBe('Brisbane');
    }
  });

  it('tolerates capitalisation and terminal punctuation', () => {
    const cases: Array<{ message: string; origin: string }> = [
      { message: 'sorry, i meant from brisbane', origin: 'brisbane' },
      { message: 'I MEANT FROM BRISBANE', origin: 'BRISBANE' },
      { message: 'Actually, from Brisbane!', origin: 'Brisbane' },
      { message: 'No, make that from Brisbane.', origin: 'Brisbane' },
      {
        message: 'Change the origin to Brisbane!',
        origin: 'Brisbane',
      },
      {
        message: 'Change the departure location to Gold Coast.',
        origin: 'Gold Coast',
      },
      { message: 'from brisbane instead', origin: 'brisbane' },
      { message: 'Departing from Brisbane instead!', origin: 'Brisbane' },
    ];
    for (const { message, origin } of cases) {
      expect(extractOrigin(message), message).toBe(origin);
    }
  });

  it('keeps bare-place repairs destination-owned (collision ownership)', () => {
    const destinationOwned = [
      'I meant Brisbane',
      'Sorry, I meant Brisbane',
      'Actually, Brisbane',
      'No, make that Brisbane',
      'Change that to Brisbane',
      'Not Sydney, Brisbane',
    ] as const;

    for (const message of destinationOwned) {
      const seed = createState({
        destination: 'Cairns',
        origin: 'Sydney',
      });
      expect(
        DESTINATION.extract({ message, currentState: seed }).stateUpdate,
        `dest:${message}`,
      ).toEqual({ destination: 'Brisbane' });
      expect(
        ORIGIN.extract({ message, currentState: seed }).stateUpdate,
        `origin:${message}`,
      ).toEqual({});
      expect(
        COMPOSITE.extract({ message, currentState: seed }).stateUpdate,
        `composite:${message}`,
      ).toEqual({ destination: 'Brisbane' });
    }
  });

  it('origin-cued repairs do not steal or pollute destination', () => {
    for (const message of [
      'Sorry, I meant from Brisbane',
      'I meant from Brisbane',
      'Actually, from Brisbane',
      'No, make that from Brisbane',
      'Change that to departing from Brisbane',
    ] as const) {
      const seed = createState({
        destination: 'Cairns',
        origin: 'Sydney',
      });
      expect(
        DESTINATION.extract({ message, currentState: seed }).stateUpdate,
        message,
      ).toEqual({});
      expect(
        COMPOSITE.extract({ message, currentState: seed }).stateUpdate,
        message,
      ).toEqual({ origin: 'Brisbane' });
    }
  });

  it('rejects negative non-origin-repair clauses', () => {
    const negatives = [
      'I meant the flight from Brisbane is cheaper',
      'Actually, find a hotel near Brisbane',
      'Change that to three adults',
      'No, make that two children',
      'Flights from Brisbane',
      'Not sure about departing from Brisbane',
      'I meant return from Brisbane on Monday',
      // Bare place remains destination-owned, not an origin repair.
      'I meant Brisbane',
    ];
    for (const message of negatives) {
      expect(
        ORIGIN.extract({
          message,
          currentState: createState({
            destination: 'Cairns',
            origin: 'Sydney',
          }),
        }).stateUpdate,
        message,
      ).toEqual({});
    }

    // Existing route behaviour: from-X-to-Y still extracts origin only.
    expect(
      ORIGIN.extract({
        message: 'From Brisbane to Cairns',
        currentState: createState({ destination: 'Hobart', origin: 'Sydney' }),
      }).stateUpdate,
    ).toEqual({ origin: 'Brisbane' });
  });

  it('preserves existing non-repair origin cues', () => {
    const preserved = [
      { message: 'from Brisbane', origin: 'Brisbane' },
      { message: 'from Brisbane instead', origin: 'Brisbane' },
      { message: 'departing from Brisbane', origin: 'Brisbane' },
      { message: 'origin is Brisbane', origin: 'Brisbane' },
      { message: 'my origin is Brisbane', origin: 'Brisbane' },
      { message: 'flying from Brisbane', origin: 'Brisbane' },
    ];
    for (const { message, origin } of preserved) {
      expect(extractOrigin(message), message).toBe(origin);
    }
  });

  it('preserves Phase 17B destination repair families', () => {
    const destinationRepairs = [
      'Sorry, I meant Cairns',
      'I meant Cairns',
      'Actually, Cairns',
      'No, make that Cairns',
      'Change that to Cairns',
      'Not Melbourne, Cairns',
    ] as const;
    for (const message of destinationRepairs) {
      const seed = createState({
        destination: 'Melbourne',
        origin: 'Sydney',
      });
      expect(
        COMPOSITE.extract({ message, currentState: seed }).stateUpdate,
        message,
      ).toEqual({ destination: 'Cairns' });
    }
  });

  it('end-to-end: Sydney → Brisbane is field-changed with Phase 16J wording', () => {
    const cases = [
      'Sorry, I meant from Brisbane',
      'Change the origin to Brisbane',
      'From Brisbane instead',
    ] as const;

    for (const [index, message] of cases.entries()) {
      const { extracted, result, classification, plan } = turn(
        message,
        {
          destination: 'Cairns',
          origin: 'Sydney',
        },
        index,
      );
      expect(extracted.stateUpdate, message).toEqual({ origin: 'Brisbane' });
      expect(result.state.origin, message).toBe('Brisbane');
      expect(result.state.destination, message).toBe('Cairns');
      expect(classification.updated, message).toEqual(['origin']);
      expect(plan.acknowledgementEvent, message).toEqual({
        kind: 'field-changed',
        field: 'origin',
      });
      expect(result.reply, message).toBe(
        `We'll depart from Brisbane instead. ${FOLLOW_UPS.departureDate}`,
      );
      expect(plan.followUpQuestion, message).toBe(FOLLOW_UPS.departureDate);
    }
  });

  it('end-to-end: null → Brisbane is field-set with Phase 16J wording', () => {
    const { extracted, result, classification, plan } = turn(
      'Sorry, I meant from Brisbane',
      {
        destination: 'Cairns',
        origin: null,
      },
      20,
    );
    expect(extracted.stateUpdate).toEqual({ origin: 'Brisbane' });
    expect(result.state.origin).toBe('Brisbane');
    expect(result.state.destination).toBe('Cairns');
    expect(classification.newlyPopulated).toEqual(['origin']);
    expect(classification.updated).toEqual([]);
    expect(plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'origin',
    });
    expect(result.reply).toBe(
      `We'll start from Brisbane. ${FOLLOW_UPS.departureDate}`,
    );
  });

  it('end-to-end: populated trip origin repair uses field-changed + 16B bridge', () => {
    const { extracted, result, classification, plan } = turn(
      'Sorry, I meant from Brisbane',
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-10',
        returnDate: '2026-08-17',
        adultCount: 2,
      },
      30,
    );
    expect(extracted.stateUpdate).toEqual({ origin: 'Brisbane' });
    expect(result.state.origin).toBe('Brisbane');
    expect(result.state.destination).toBe('Cairns');
    expect(classification.updated).toContain('origin');
    expect(plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
    expect(result.reply).toBe(
      "We'll depart from Brisbane instead. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );
  });
});
