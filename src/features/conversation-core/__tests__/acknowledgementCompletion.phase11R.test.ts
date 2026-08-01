import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';

/**
 * Phase 11R — acknowledgement-completion characterisation.
 *
 * Proves every supported non-capability travel field has deterministic
 * acknowledgement coverage for set/changed, explicit removal, and unchanged
 * null. Does not change production behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-11r-ack-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

type NonCapabilityField =
  | 'destination'
  | 'origin'
  | 'departureDate'
  | 'returnDate'
  | 'adultCount'
  | 'childCount'
  | 'infantCount';

const FIELD_COVERAGE: ReadonlyArray<{
  field: NonCapabilityField;
  stored: string | number;
  replacement: string | number;
  setAcknowledgement: string;
  changeAcknowledgement: string;
  removalAcknowledgement: string;
}> = [
  {
    field: 'destination',
    stored: 'Cairns',
    replacement: 'Hobart',
    setAcknowledgement: 'Great — Cairns.',
    changeAcknowledgement: 'Great — Hobart.',
    removalAcknowledgement: 'Destination removed.',
  },
  {
    field: 'origin',
    stored: 'Sydney',
    replacement: 'Melbourne',
    setAcknowledgement: 'Perfect — departing from Sydney.',
    changeAcknowledgement: 'Perfect — departing from Melbourne.',
    removalAcknowledgement: 'Departure location removed.',
  },
  {
    field: 'departureDate',
    stored: '2026-08-28',
    replacement: '2026-10-01',
    setAcknowledgement: 'Perfect — departing on 2026-08-28.',
    changeAcknowledgement: 'Perfect — departing on 2026-10-01.',
    removalAcknowledgement: 'Departure date removed.',
  },
  {
    field: 'returnDate',
    stored: '2026-09-05',
    replacement: '2026-10-10',
    setAcknowledgement: 'Perfect — returning on 2026-09-05.',
    changeAcknowledgement: 'Perfect — returning on 2026-10-10.',
    removalAcknowledgement: 'Return date removed.',
  },
  {
    field: 'adultCount',
    stored: 2,
    replacement: 3,
    setAcknowledgement: 'Perfect — 2 adults travelling.',
    changeAcknowledgement: 'Perfect — 3 adults travelling.',
    removalAcknowledgement: 'Adult count removed.',
  },
  {
    field: 'childCount',
    stored: 1,
    replacement: 2,
    setAcknowledgement: 'Perfect — 1 child travelling.',
    changeAcknowledgement: 'Perfect — 2 children travelling.',
    removalAcknowledgement: 'Child count removed.',
  },
  {
    field: 'infantCount',
    stored: 1,
    replacement: 2,
    setAcknowledgement: 'Perfect — 1 infant travelling.',
    changeAcknowledgement: 'Perfect — 2 infants travelling.',
    removalAcknowledgement: 'Infant count removed.',
  },
];

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

/** Complete trip core with all seven fields populated. */
function filled(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-09-05',
    adultCount: 2,
    childCount: 1,
    infantCount: 1,
    ...overrides,
  });
}

function acknowledgementFor(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  return (
    selectConversationAcknowledgement(
      state,
      classifyConversationStateChange(previousState, state),
    )?.text ?? null
  );
}

function planFor(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  return createConversationReplyPlan({
    state,
    classification: classifyConversationStateChange(previousState, state),
  });
}

describe('phase 11R — acknowledgement completion characterisation', () => {
  it.each(FIELD_COVERAGE)(
    '$field: set or changed uses dedicated acknowledgement',
    ({
      field,
      stored,
      replacement,
      setAcknowledgement,
      changeAcknowledgement,
    }) => {
      // null → stored
      const setPrevious = filled({ [field]: null });
      const setNext = filled({ [field]: stored });
      expect(acknowledgementFor(setPrevious, setNext)).toBe(setAcknowledgement);

      // stored A → stored B
      const changePrevious = filled({ [field]: stored });
      const changeNext = filled({ [field]: replacement });
      expect(acknowledgementFor(changePrevious, changeNext)).toBe(
        changeAcknowledgement,
      );
    },
  );

  it.each(FIELD_COVERAGE)(
    '$field: explicit removal uses dedicated removal acknowledgement',
    ({ field, stored, removalAcknowledgement }) => {
      const previous = filled({ [field]: stored });
      const next = filled({ [field]: null });
      const classification = classifyConversationStateChange(previous, next);

      expect(classification.updated).toContain(field);
      expect(acknowledgementFor(previous, next)).toBe(removalAcknowledgement);
      expect(acknowledgementFor(previous, next)).not.toBe('Perfect.');
      expect(planFor(previous, next).acknowledgements).toEqual([
        removalAcknowledgement,
      ]);
    },
  );

  it.each(FIELD_COVERAGE)(
    '$field: unchanged null does not produce removal acknowledgement',
    ({ field, removalAcknowledgement }) => {
      const previous = filled({ [field]: null });
      const next = filled({ [field]: null });
      const classification = classifyConversationStateChange(previous, next);

      expect(classification.updated).not.toContain(field);
      expect(acknowledgementFor(previous, next)).toBeNull();
      expect(acknowledgementFor(previous, next)).not.toBe(
        removalAcknowledgement,
      );
      expect(planFor(previous, next).acknowledgements).toEqual([]);
    },
  );

  it('does not use generic Perfect. for an explicit clear of any of the seven fields', () => {
    for (const { field, stored } of FIELD_COVERAGE) {
      const acknowledgement = acknowledgementFor(
        filled({ [field]: stored }),
        filled({ [field]: null }),
      );
      expect(acknowledgement).not.toBe('Perfect.');
      expect(acknowledgement).not.toBeNull();
    }
  });

  it('emits at most one acknowledgement when multiple non-capability fields change', () => {
    const previous = filled();
    const next = filled({
      destination: 'Hobart',
      origin: 'Melbourne',
      departureDate: '2026-10-01',
      returnDate: '2026-10-10',
      adultCount: 4,
      childCount: 2,
      infantCount: 2,
    });
    const acknowledgement = acknowledgementFor(previous, next);
    const plan = planFor(previous, next);

    expect(acknowledgement).toBe('Great — Hobart.');
    expect(plan.acknowledgements).toEqual(['Great — Hobart.']);
    expect(plan.acknowledgements).toHaveLength(1);
    expect(acknowledgement!.includes('\n')).toBe(false);
  });

  it('preserves acknowledgement priority across capability and non-capability collisions', () => {
    // newly enabled beats destination removal
    expect(
      acknowledgementFor(
        filled({ flightsRequested: null }),
        filled({ destination: null, flightsRequested: true }),
      ),
    ).toBe("I've added flights to your trip requirements.");

    // newly disabled beats destination removal
    expect(
      acknowledgementFor(
        filled({ flightsRequested: true }),
        filled({ destination: null, flightsRequested: false }),
      ),
    ).toBe("I've removed flights from your trip requirements.");

    // destination set beats origin removal
    expect(
      acknowledgementFor(
        filled({ destination: 'Brisbane' }),
        filled({ destination: 'Hobart', origin: null }),
      ),
    ).toBe('Great — Hobart.');

    // destination removal beats origin removal
    expect(
      acknowledgementFor(
        filled(),
        filled({ destination: null, origin: null }),
      ),
    ).toBe('Destination removed.');

    // origin removal beats departure-date removal
    expect(
      acknowledgementFor(
        filled(),
        filled({ origin: null, departureDate: null }),
      ),
    ).toBe('Departure location removed.');

    // departure-date removal beats return-date removal
    expect(
      acknowledgementFor(
        filled(),
        filled({ departureDate: null, returnDate: null }),
      ),
    ).toBe('Departure date removed.');

    // return-date removal beats adult-count removal
    expect(
      acknowledgementFor(
        filled(),
        filled({ returnDate: null, adultCount: null }),
      ),
    ).toBe('Return date removed.');

    // adult-count removal beats child-count removal
    expect(
      acknowledgementFor(
        filled(),
        filled({ adultCount: null, childCount: null }),
      ),
    ).toBe('Adult count removed.');

    // child-count removal beats infant-count removal
    expect(
      acknowledgementFor(
        filled(),
        filled({ childCount: null, infantCount: null }),
      ),
    ).toBe('Child count removed.');

    // infant-count removal alone is dedicated, not generic
    expect(
      acknowledgementFor(filled(), filled({ infantCount: null })),
    ).toBe('Infant count removed.');
  });

  it('returns at most one acknowledgement when removal co-occurs with interpretation-only clear', () => {
    const acknowledgement = acknowledgementFor(
      filled({ flightsRequested: true }),
      filled({
        infantCount: null,
        flightsRequested: null,
      }),
    );
    expect(acknowledgement).toBe('Infant count removed.');
    expect(acknowledgement!.includes('\n')).toBe(false);
    expect(planFor(
      filled({ flightsRequested: true }),
      filled({ infantCount: null, flightsRequested: null }),
    ).acknowledgements).toHaveLength(1);
  });
});
