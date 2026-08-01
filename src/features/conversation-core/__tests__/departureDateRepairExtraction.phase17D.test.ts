import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

/**
 * Phase 17D — departure-date repair extraction.
 *
 * Ownership:
 *   Explicit departure cue → departureDate-owned
 *   Explicit return cue → returnDate-owned
 *   Bare repaired date → do not newly assign (stays unowned)
 *
 * Root cause: \\bactually\\b / \\bnot\\b hard-blocked repair prefaces;
 * "change/make the departure date" cues were missing. "meant depart on"
 * already reached the depart cue when actually/not were absent.
 */

const DEPARTURE = new DepartureDateConversationStateExtractor();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17d',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

const DEPARTURE_REPAIR_FAMILIES = [
  'Sorry, I meant depart on 29 August 2026',
  'I meant depart on 29 August 2026',
  'Actually, depart on 29 August 2026',
  'No, make the departure date 29 August 2026',
  'Change the departure date to 29 August 2026',
  'Change that to departing on 29 August 2026',
  'Not departing on 28 August 2026, departing on 29 August 2026',
] as const;

function extractDeparture(message: string): string | null {
  return (
    DEPARTURE.extract({
      message,
      currentState: createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
      }),
    }).stateUpdate.departureDate ?? null
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
    userEntryId: `user-17d-${index}`,
    assistantEntryId: `assistant-17d-${index}`,
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

describe('Phase 17D — departure-date repair extraction', () => {
  it('extracts all supported explicit departure repair families', () => {
    for (const message of DEPARTURE_REPAIR_FAMILIES) {
      expect(extractDeparture(message), message).toBe('2026-08-29');
      expect(
        COMPOSITE.extract({
          message,
          currentState: createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: '2026-08-28',
            returnDate: '2026-09-05',
          }),
        }).stateUpdate,
        message,
      ).toEqual({ departureDate: '2026-08-29' });
    }
  });

  it('replaces an existing departure date and sets a null departure date', () => {
    for (const message of DEPARTURE_REPAIR_FAMILIES) {
      expect(
        DEPARTURE.extract({
          message,
          currentState: createState({ departureDate: '2026-08-28' }),
        }).stateUpdate.departureDate,
        `replace:${message}`,
      ).toBe('2026-08-29');
      expect(
        DEPARTURE.extract({
          message,
          currentState: createState({ departureDate: null }),
        }).stateUpdate.departureDate,
        `null:${message}`,
      ).toBe('2026-08-29');
    }
  });

  it('tolerates capitalisation, punctuation, and equivalent departure wording', () => {
    const cases: Array<{ message: string; date: string }> = [
      {
        message: 'sorry, i meant depart on 29 august 2026',
        date: '2026-08-29',
      },
      {
        message: 'Actually, Depart on 29 August 2026!',
        date: '2026-08-29',
      },
      {
        message: 'Actually leave on 29 August 2026.',
        date: '2026-08-29',
      },
      {
        message: 'Change the departure date to 2026-08-29',
        date: '2026-08-29',
      },
      {
        message: 'No, make the departure date 29 August 2026!',
        date: '2026-08-29',
      },
    ];
    for (const { message, date } of cases) {
      expect(extractDeparture(message), message).toBe(date);
    }
  });

  it('preserves existing no-year date behaviour (no new ownership without year)', () => {
    expect(extractDeparture('Sorry, I meant depart on 29 August')).toBeNull();
    expect(extractDeparture('Depart on 29 August')).toBeNull();
  });

  it('does not newly assign bare repaired dates as departureDate', () => {
    const bareDates = [
      'I meant 29 August 2026',
      'Actually, 29 August 2026',
      'No, make that 29 August 2026',
      'Sorry, I meant 29 August 2026',
    ];
    for (const message of bareDates) {
      expect(extractDeparture(message), message).toBeNull();
      expect(
        COMPOSITE.extract({
          message,
          currentState: createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: '2026-08-28',
          }),
        }).stateUpdate.departureDate,
        message,
      ).toBeUndefined();
    }
  });

  it('keeps return-cued repairs return-owned, not departure-owned', () => {
    const returnOwned = [
      'I meant return on 29 August 2026',
      'Actually, return on 29 August 2026',
      'Change the return date to 29 August 2026',
      'Sorry, I meant Return on 29 August 2026',
    ];
    for (const message of returnOwned) {
      expect(extractDeparture(message), message).toBeNull();
    }
    // Return extractor still owns meant+Return on (existing behaviour).
    expect(
      COMPOSITE.extract({
        message: 'I meant return on 29 August 2026',
        currentState: createState({
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        }),
      }).stateUpdate,
    ).toEqual({ returnDate: '2026-08-29' });
  });

  it('rejects negative non-repair clauses and origin collisions', () => {
    const negatives = [
      'Change that to three adults',
      'No, make that two children',
      'Departing from Brisbane',
      'I meant the flight departing on 29 August is cheaper',
      'I meant the flight departing on 29 August 2026 is cheaper',
      'Not sure about departing on 29 August',
      'Find a hotel for 29 August',
      'Not 28 August, 29 August 2026',
    ];
    for (const message of negatives) {
      expect(extractDeparture(message), message).toBeNull();
    }

    // Origin repair must not become a departure-date patch.
    expect(
      COMPOSITE.extract({
        message: 'Sorry, I meant from Brisbane',
        currentState: createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      }).stateUpdate,
    ).toEqual({ origin: 'Brisbane' });
  });

  it('preserves existing non-repair departure cues', () => {
    const preserved = [
      'Depart on 29 August 2026',
      'Leave on 29 August 2026',
      'Departure date is 29 August 2026',
      'Leaving on 29 August 2026',
      'Departure is 29 August 2026',
    ];
    for (const message of preserved) {
      expect(extractDeparture(message), message).toBe('2026-08-29');
    }
  });

  it('preserves Phase 17B destination and Phase 17C origin repairs', () => {
    expect(
      COMPOSITE.extract({
        message: 'Sorry, I meant Cairns',
        currentState: createState({
          destination: 'Melbourne',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      }).stateUpdate,
    ).toEqual({ destination: 'Cairns' });

    expect(
      COMPOSITE.extract({
        message: 'Sorry, I meant from Brisbane',
        currentState: createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      }).stateUpdate,
    ).toEqual({ origin: 'Brisbane' });
  });

  it('end-to-end: existing date → corrected date is field-changed', () => {
    const cases = [
      'Sorry, I meant depart on 29 August 2026',
      'Actually, depart on 29 August 2026',
      'Change the departure date to 29 August 2026',
    ] as const;

    for (const [index, message] of cases.entries()) {
      const { extracted, result, classification, plan } = turn(
        message,
        {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        },
        index,
      );
      expect(extracted.stateUpdate, message).toEqual({
        departureDate: '2026-08-29',
      });
      expect(result.state.departureDate, message).toBe('2026-08-29');
      expect(result.state.returnDate, message).toBe('2026-09-05');
      expect(result.state.origin, message).toBe('Sydney');
      expect(result.state.destination, message).toBe('Cairns');
      expect(classification.updated, message).toEqual(['departureDate']);
      expect(plan.acknowledgementEvent, message).toEqual({
        kind: 'field-changed',
        field: 'departureDate',
      });
      expect(result.reply, message).toBe(
        "Departure is now set for 2026-08-29. Is there anything else you'd like me to consider? What else should I know about your trip?",
      );
    }
  });

  it('end-to-end: null → corrected date is field-set', () => {
    const { extracted, result, classification, plan } = turn(
      'Sorry, I meant depart on 29 August 2026',
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: null,
        returnDate: null,
      },
      20,
    );
    expect(extracted.stateUpdate).toEqual({ departureDate: '2026-08-29' });
    expect(result.state.departureDate).toBe('2026-08-29');
    expect(result.state.returnDate).toBeNull();
    expect(classification.newlyPopulated).toEqual(['departureDate']);
    expect(classification.updated).toEqual([]);
    expect(plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'departureDate',
    });
    expect(result.reply).toBe(
      `Departure is set for 2026-08-29. ${FOLLOW_UPS.returnDate}`,
    );
  });
});
