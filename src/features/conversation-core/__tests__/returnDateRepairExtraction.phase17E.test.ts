import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

/**
 * Phase 17E — return-date repair extraction.
 *
 * Ownership:
 *   Explicit return cue → returnDate-owned
 *   Explicit departure cue → departureDate-owned
 *   Bare repaired date → unowned
 *
 * Root cause: \\bactually\\b / \\bnot\\b hard-blocked repair prefaces;
 * "meant return on" already reached the return cue when those blocks were
 * absent. Contrast repair and cheaper-clause protection were missing.
 */

const RETURN = new ReturnDateConversationStateExtractor();
const COMPOSITE = createConversationStateExtractor();

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17e',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

const RETURN_REPAIR_FAMILIES = [
  'Sorry, I meant return on 2 September 2026',
  'I meant return on 2 September 2026',
  'Actually, return on 2 September 2026',
  'No, make the return date 2 September 2026',
  'Change the return date to 2 September 2026',
  'Change that to returning on 2 September 2026',
  'Not returning on 1 September 2026, returning on 2 September 2026',
] as const;

function extractReturn(message: string): string | null {
  return (
    RETURN.extract({
      message,
      currentState: createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-01',
      }),
    }).stateUpdate.returnDate ?? null
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
    userEntryId: `user-17e-${index}`,
    assistantEntryId: `assistant-17e-${index}`,
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

describe('Phase 17E — return-date repair extraction', () => {
  it('extracts all supported explicit return repair families', () => {
    for (const message of RETURN_REPAIR_FAMILIES) {
      expect(extractReturn(message), message).toBe('2026-09-02');
      expect(
        COMPOSITE.extract({
          message,
          currentState: createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: '2026-08-28',
            returnDate: '2026-09-01',
          }),
        }).stateUpdate,
        message,
      ).toEqual({ returnDate: '2026-09-02' });
    }
  });

  it('replaces an existing return date and sets a null return date', () => {
    for (const message of RETURN_REPAIR_FAMILIES) {
      expect(
        RETURN.extract({
          message,
          currentState: createState({ returnDate: '2026-09-01' }),
        }).stateUpdate.returnDate,
        `replace:${message}`,
      ).toBe('2026-09-02');
      expect(
        RETURN.extract({
          message,
          currentState: createState({ returnDate: null }),
        }).stateUpdate.returnDate,
        `null:${message}`,
      ).toBe('2026-09-02');
    }
  });

  it('tolerates capitalisation, punctuation, and equivalent return wording', () => {
    const cases: Array<{ message: string; date: string }> = [
      {
        message: 'sorry, i meant return on 2 september 2026',
        date: '2026-09-02',
      },
      {
        message: 'Actually, Return on 2 September 2026!',
        date: '2026-09-02',
      },
      {
        message: 'Actually come back on 2 September 2026.',
        date: '2026-09-02',
      },
      {
        message: 'Change the return date to 2026-09-02',
        date: '2026-09-02',
      },
      {
        message: 'No, make the return date 2 September 2026!',
        date: '2026-09-02',
      },
    ];
    for (const { message, date } of cases) {
      expect(extractReturn(message), message).toBe(date);
    }
  });

  it('preserves existing no-year date behaviour', () => {
    expect(extractReturn('Sorry, I meant return on 2 September')).toBeNull();
    expect(extractReturn('Return on 2 September')).toBeNull();
  });

  it('does not newly assign bare repaired dates as returnDate', () => {
    const bareDates = [
      'I meant 2 September 2026',
      'Actually, 2 September 2026',
      'No, make that 2 September 2026',
      'Sorry, I meant 2 September 2026',
    ];
    for (const message of bareDates) {
      expect(extractReturn(message), message).toBeNull();
      expect(
        COMPOSITE.extract({
          message,
          currentState: createState({
            departureDate: '2026-08-28',
            returnDate: '2026-09-01',
          }),
        }).stateUpdate.returnDate,
        message,
      ).toBeUndefined();
    }
  });

  it('keeps departure-cued repairs departure-owned, not return-owned', () => {
    const departureOwned = [
      'I meant depart on 2 September 2026',
      'Actually, depart on 2 September 2026',
      'Change the departure date to 2 September 2026',
      'Sorry, I meant depart on 2 September 2026',
    ];
    for (const message of departureOwned) {
      expect(extractReturn(message), message).toBeNull();
      expect(
        COMPOSITE.extract({
          message,
          currentState: createState({
            departureDate: '2026-08-28',
            returnDate: '2026-09-01',
          }),
        }).stateUpdate,
        message,
      ).toEqual({ departureDate: '2026-09-02' });
    }
  });

  it('rejects negative non-repair clauses and origin collisions', () => {
    const negatives = [
      'Change that to three adults',
      'No, make that two children',
      'Returning from Brisbane',
      'I meant the flight returning on 2 September is cheaper',
      'I meant the flight returning on 2 September 2026 is cheaper',
      'Not sure about returning on 2 September',
      'Find a hotel until 2 September',
    ];
    for (const message of negatives) {
      expect(extractReturn(message), message).toBeNull();
    }

    // Origin still owns returning-from / return-from travel origin forms.
    expect(
      COMPOSITE.extract({
        message: 'Returning from Brisbane',
        currentState: createState({
          destination: 'Cairns',
          origin: 'Sydney',
          returnDate: '2026-09-01',
        }),
      }).stateUpdate,
    ).toEqual({ origin: 'Brisbane' });
  });

  it('preserves existing non-repair return cues', () => {
    const preserved = [
      'Return on 2 September 2026',
      'Come back on 2 September 2026',
      'Return date is 2 September 2026',
      'Coming back on 2 September 2026',
      'returning on 2 September 2026',
    ];
    for (const message of preserved) {
      expect(extractReturn(message), message).toBe('2026-09-02');
    }
  });

  it('preserves Phase 17B/17C/17D destination, origin, and departure repairs', () => {
    expect(
      COMPOSITE.extract({
        message: 'Sorry, I meant Cairns',
        currentState: createState({
          destination: 'Melbourne',
          origin: 'Sydney',
          returnDate: '2026-09-01',
        }),
      }).stateUpdate,
    ).toEqual({ destination: 'Cairns' });

    expect(
      COMPOSITE.extract({
        message: 'Sorry, I meant from Brisbane',
        currentState: createState({
          destination: 'Cairns',
          origin: 'Sydney',
          returnDate: '2026-09-01',
        }),
      }).stateUpdate,
    ).toEqual({ origin: 'Brisbane' });

    expect(
      COMPOSITE.extract({
        message: 'Sorry, I meant depart on 29 August 2026',
        currentState: createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-01',
        }),
      }).stateUpdate,
    ).toEqual({ departureDate: '2026-08-29' });
  });

  it('end-to-end: existing date → corrected date is field-changed', () => {
    const cases = [
      'Sorry, I meant return on 2 September 2026',
      'Actually, return on 2 September 2026',
      'Change the return date to 2 September 2026',
    ] as const;

    for (const [index, message] of cases.entries()) {
      const { extracted, result, classification, plan } = turn(
        message,
        {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-01',
          adultCount: 2,
        },
        index,
      );
      expect(extracted.stateUpdate, message).toEqual({
        returnDate: '2026-09-02',
      });
      expect(result.state.returnDate, message).toBe('2026-09-02');
      expect(result.state.departureDate, message).toBe('2026-08-28');
      expect(result.state.origin, message).toBe('Sydney');
      expect(result.state.destination, message).toBe('Cairns');
      expect(classification.updated, message).toEqual(['returnDate']);
      expect(plan.acknowledgementEvent, message).toEqual({
        kind: 'field-changed',
        field: 'returnDate',
      });
      expect(result.reply, message).toBe(
        "Return is now set for 2026-09-02. Is there anything else you'd like me to consider? What else should I know about your trip?",
      );
    }
  });

  it('end-to-end: null → corrected date is field-set', () => {
    const { extracted, result, classification, plan } = turn(
      'Sorry, I meant return on 2 September 2026',
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: null,
      },
      20,
    );
    expect(extracted.stateUpdate).toEqual({ returnDate: '2026-09-02' });
    expect(result.state.returnDate).toBe('2026-09-02');
    expect(result.state.departureDate).toBe('2026-08-28');
    expect(classification.newlyPopulated).toEqual(['returnDate']);
    expect(classification.updated).toEqual([]);
    expect(plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'returnDate',
    });
    expect(result.reply).toBe(
      "Return is set for 2026-09-02. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );
  });
});
