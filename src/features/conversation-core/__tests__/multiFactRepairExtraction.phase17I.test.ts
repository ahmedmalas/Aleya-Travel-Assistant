import { describe, expect, it } from 'vitest';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';

/**
 * Phase 17I — multi-fact destination/origin repair place boundaries.
 *
 * Shared clause-boundary helper trims repaired place captures before following
 * origin/date/passenger clauses. Does not change no-year date policy,
 * extractor order, or acknowledgement priority.
 */

const DEST = new DestinationConversationStateExtractor();
const ORIGIN = new OriginConversationStateExtractor();
const DEPART = new DepartureDateConversationStateExtractor();
const ADULT = new AdultCountConversationStateExtractor();
const CHILD = new ChildCountConversationStateExtractor();
const COMPOSITE = createConversationStateExtractor();

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17i',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    destination: 'Melbourne',
    origin: 'Adelaide',
    departureDate: null,
    returnDate: null,
    adultCount: 2,
    childCount: null,
    infantCount: null,
    ...overrides,
  };
}

function turn(
  message: string,
  seed: Partial<ConversationCoreState> = {},
  index = 0,
) {
  const previous = createState(seed);
  const input = { message, currentState: previous };
  const destinationExtractor = DEST.extract(input).stateUpdate;
  const originExtractor = ORIGIN.extract(input).stateUpdate;
  const departureExtractor = DEPART.extract(input).stateUpdate;
  const adultExtractor = ADULT.extract(input).stateUpdate;
  const childExtractor = CHILD.extract(input).stateUpdate;
  const extracted = COMPOSITE.extract(input);
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: `user-17i-${index}`,
    assistantEntryId: `assistant-17i-${index}`,
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
  return {
    previous,
    destinationExtractor,
    originExtractor,
    departureExtractor,
    adultExtractor,
    childExtractor,
    extracted,
    result,
    classification,
    plan,
  };
}

describe('Phase 17I — multi-fact repair place boundaries', () => {
  it('primary three-field repair extracts clean destination, origin, and departure', () => {
    const t = turn(
      'Sorry, I meant Cairns, leaving from Sydney on 28 August 2026',
    );
    expect(t.destinationExtractor).toEqual({ destination: 'Cairns' });
    expect(t.originExtractor).toEqual({ origin: 'Sydney' });
    expect(t.departureExtractor).toEqual({ departureDate: '2026-08-28' });
    expect(t.extracted.stateUpdate).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    expect(t.result.state.destination).toBe('Cairns');
    expect(t.result.state.origin).toBe('Sydney');
    expect(t.result.state.departureDate).toBe('2026-08-28');
    expect(t.classification.updated).toEqual(['destination', 'origin']);
    expect(t.classification.newlyPopulated).toEqual(['departureDate']);
    // Existing acknowledgement priority: destination wins over origin/date.
    expect(t.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(t.plan.followUpQuestion).toBe('When would you like to return?');
    expect(t.result.reply).toBe(
      'Updated — Cairns it is. When would you like to return?',
    );
  });

  it('extracts destination + origin for leaving/departing repair forms', () => {
    for (const message of [
      'Sorry, I meant Cairns, leaving from Sydney',
      'Actually, Cairns, departing from Sydney',
      'I meant Cairns, leaving from Sydney',
      'I meant Cairns and leaving from Sydney',
    ] as const) {
      const t = turn(message);
      expect(t.destinationExtractor, message).toEqual({
        destination: 'Cairns',
      });
      expect(t.originExtractor, message).toEqual({ origin: 'Sydney' });
      expect(t.extracted.stateUpdate, message).toEqual({
        destination: 'Cairns',
        origin: 'Sydney',
      });
      expect(t.result.reply, message).toBe(
        'Updated — Cairns it is. When would you like to depart?',
      );
    }
  });

  it('extracts destination + departure for date-trailer repairs', () => {
    for (const message of [
      'No, make that Cairns, leaving on 28 August 2026',
      'Change that to Cairns, departing on 28 August 2026',
    ] as const) {
      const t = turn(message);
      expect(t.destinationExtractor, message).toEqual({
        destination: 'Cairns',
      });
      expect(t.departureExtractor, message).toEqual({
        departureDate: '2026-08-28',
      });
      expect(t.extracted.stateUpdate, message).toEqual({
        destination: 'Cairns',
        departureDate: '2026-08-28',
      });
      expect(t.plan.acknowledgementEvent, message).toEqual({
        kind: 'field-changed',
        field: 'destination',
      });
      expect(t.result.reply, message).toBe(
        'Updated — Cairns it is. When would you like to return?',
      );
    }
  });

  it('extracts clean origin + departure without absorbing date text', () => {
    const meant = turn(
      'Sorry, I meant from Sydney, leaving on 28 August 2026',
    );
    expect(meant.originExtractor).toEqual({ origin: 'Sydney' });
    expect(meant.departureExtractor).toEqual({
      departureDate: '2026-08-28',
    });
    expect(meant.extracted.stateUpdate).toEqual({
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    expect(meant.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
    expect(meant.result.reply).toBe(
      "We'll depart from Sydney instead. When would you like to return?",
    );

    const actually = turn(
      'Actually, from Sydney, depart on 28 August 2026',
    );
    expect(actually.originExtractor).toEqual({ origin: 'Sydney' });
    expect(actually.departureExtractor).toEqual({
      departureDate: '2026-08-28',
    });
  });

  it('supports destination/origin + passenger coexistence', () => {
    const destAdults = turn('I meant Cairns, 3 adults');
    expect(destAdults.destinationExtractor).toEqual({
      destination: 'Cairns',
    });
    expect(destAdults.adultExtractor).toEqual({ adultCount: 3 });
    expect(destAdults.extracted.stateUpdate).toEqual({
      destination: 'Cairns',
      adultCount: 3,
    });
    expect(destAdults.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(destAdults.result.reply).toBe(
      'Updated — Cairns it is. When would you like to depart?',
    );

    const destChildren = turn('Change that to Cairns, 2 children');
    expect(destChildren.destinationExtractor).toEqual({
      destination: 'Cairns',
    });
    expect(destChildren.childExtractor).toEqual({ childCount: 2 });
    expect(destChildren.extracted.stateUpdate).toEqual({
      destination: 'Cairns',
      childCount: 2,
    });

    const originAdults = turn('Sorry, I meant from Sydney, 3 adults');
    expect(originAdults.originExtractor).toEqual({ origin: 'Sydney' });
    expect(originAdults.adultExtractor).toEqual({ adultCount: 3 });
    expect(originAdults.extracted.stateUpdate).toEqual({
      origin: 'Sydney',
      adultCount: 3,
    });

    const actuallyOriginAdults = turn('Actually, from Sydney, 2 adults');
    expect(actuallyOriginAdults.originExtractor).toEqual({
      origin: 'Sydney',
    });
    expect(actuallyOriginAdults.adultExtractor).toEqual({ adultCount: 2 });
    expect(actuallyOriginAdults.extracted.stateUpdate).toEqual({
      origin: 'Sydney',
      adultCount: 2,
    });
    // Equal adultCount → origin-only change.
    expect(actuallyOriginAdults.classification.updated).toEqual(['origin']);
    expect(actuallyOriginAdults.result.reply).toBe(
      "We'll depart from Sydney instead. When would you like to depart?",
    );

    // Phase 17G multi-passenger boundary preserved.
    expect(
      turn('Actually, 2 adults and 1 child').extracted.stateUpdate,
    ).toEqual({});
  });

  it('handles comma, space, semicolon, em-dash, and and boundaries', () => {
    for (const message of [
      'I meant Cairns, from Sydney',
      'I meant Cairns from Sydney',
      'I meant Cairns; from Sydney',
      'I meant Cairns — from Sydney',
      'I meant Cairns, leaving from Sydney',
      'I meant Cairns and leaving from Sydney',
    ] as const) {
      const t = turn(message);
      expect(t.result.state.destination, message).toBe('Cairns');
      expect(t.result.state.origin, message).toBe('Sydney');
      expect(t.extracted.stateUpdate.destination, message).toBe('Cairns');
      expect(t.extracted.stateUpdate.origin, message).toBe('Sydney');
      expect(t.extracted.stateUpdate.destination, message).not.toMatch(
        /[,;—–-]/,
      );
    }
  });

  it('supports contrast destination + trailing origin', () => {
    expect(turn('Not Melbourne, Cairns').extracted.stateUpdate).toEqual({
      destination: 'Cairns',
    });

    const withOrigin = turn('Not Melbourne, Cairns, from Sydney');
    expect(withOrigin.destinationExtractor).toEqual({
      destination: 'Cairns',
    });
    expect(withOrigin.originExtractor).toEqual({ origin: 'Sydney' });
    expect(withOrigin.extracted.stateUpdate).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
    });
    expect(withOrigin.result.state.destination).toBe('Cairns');
    expect(withOrigin.result.state.origin).toBe('Sydney');
    expect(withOrigin.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(withOrigin.result.reply).toBe(
      'Updated — Cairns it is. When would you like to depart?',
    );
  });

  it('preserves single-field Phase 17B destination repairs', () => {
    for (const message of [
      'Sorry, I meant Cairns',
      'I meant Cairns',
      'Actually, Cairns',
      'No, make that Cairns',
      'Change that to Cairns',
      'Not Melbourne, Cairns',
    ] as const) {
      const t = turn(message);
      expect(t.extracted.stateUpdate, message).toEqual({
        destination: 'Cairns',
      });
      expect(t.result.state.origin, message).toBe('Adelaide');
      expect(t.result.reply, message).toContain('Updated — Cairns it is.');
    }
  });

  it('preserves single-field Phase 17C origin repairs', () => {
    for (const message of [
      'Sorry, I meant from Sydney',
      'I meant from Sydney',
      'Actually, from Sydney',
      'No, make that from Sydney',
      'Change that to departing from Sydney',
      'Change the origin to Sydney',
      'From Sydney instead',
      'Departing from Sydney instead',
    ] as const) {
      const t = turn(message);
      expect(t.extracted.stateUpdate, message).toEqual({ origin: 'Sydney' });
      expect(t.result.state.destination, message).toBe('Melbourne');
      expect(t.result.reply, message).toContain(
        "We'll depart from Sydney instead.",
      );
    }
  });

  it('preserves Phase 17D departure repairs and Phase 17G passenger repairs', () => {
    const departure = turn('Actually, depart on 30 August 2026', {
      departureDate: '2026-08-10',
    });
    expect(departure.extracted.stateUpdate).toEqual({
      departureDate: '2026-08-30',
    });

    const adults = turn('Actually, 3 adults');
    expect(adults.extracted.stateUpdate).toEqual({ adultCount: 3 });
    expect(adults.result.reply).toContain('Updated to 3 adults.');
  });

  it('keeps no-year departure policy unchanged while cleaning place captures', () => {
    const destNoYear = turn('Sorry, I meant Cairns, leaving on 28 August');
    expect(destNoYear.destinationExtractor).toEqual({
      destination: 'Cairns',
    });
    expect(destNoYear.departureExtractor).toEqual({});
    expect(destNoYear.extracted.stateUpdate).toEqual({
      destination: 'Cairns',
    });
    expect(destNoYear.result.state.departureDate).toBeNull();

    const originNoYear = turn(
      'Actually, from Sydney, departing on 28 August',
    );
    expect(originNoYear.originExtractor).toEqual({ origin: 'Sydney' });
    expect(originNoYear.departureExtractor).toEqual({});
    expect(originNoYear.extracted.stateUpdate).toEqual({ origin: 'Sydney' });
    expect(originNoYear.result.state.departureDate).toBeNull();
  });

  it('does not truncate valid multi-word place names', () => {
    expect(
      turn('Destination is Cairns North').extracted.stateUpdate,
    ).toEqual({ destination: 'Cairns North' });
    expect(turn('I meant Port Macquarie').extracted.stateUpdate).toEqual({
      destination: 'Port Macquarie',
    });
    expect(
      turn('Actually, Ho Chi Minh City').extracted.stateUpdate,
    ).toEqual({ destination: 'Ho Chi Minh City' });
    expect(
      turn('Change that to Frankfurt am Main').extracted.stateUpdate,
    ).toEqual({ destination: 'Frankfurt am Main' });
    expect(
      turn('From Newcastle upon Tyne instead').extracted.stateUpdate,
    ).toEqual({ origin: 'Newcastle upon Tyne' });
    expect(
      turn('Departing from Rio de Janeiro instead').extracted.stateUpdate,
    ).toEqual({ origin: 'Rio de Janeiro' });
  });

  it('rejects negative contextual sentences for unintended place fields', () => {
    expect(
      turn('Actually, I need a hotel in Cairns').extracted.stateUpdate
        .destination,
    ).toBeUndefined();
    expect(
      turn('Actually, I need a hotel in Cairns').extracted.stateUpdate.origin,
    ).toBeUndefined();

    expect(
      turn('I meant the hotel should be in Sydney').extracted.stateUpdate
        .destination,
    ).toBeUndefined();
    expect(
      turn('I meant the hotel should be in Sydney').extracted.stateUpdate
        .origin,
    ).toBeUndefined();

    expect(
      turn('The flight from Brisbane is cheaper').extracted.stateUpdate.origin,
    ).toBeUndefined();
    expect(
      turn('Not sure about Cairns from Sydney').extracted.stateUpdate,
    ).toEqual({});
  });
});
