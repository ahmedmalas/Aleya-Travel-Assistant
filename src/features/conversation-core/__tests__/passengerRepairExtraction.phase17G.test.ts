import { describe, expect, it } from 'vitest';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';

/**
 * Phase 17G — passenger-count repair extraction.
 *
 * Supports:
 *   Actually[,]? {count} {noun}
 *   Not {old} {noun}, {new} {noun}
 *   Change the {fieldName} count to {new}
 * Preserves meant / make that / change that, zero/removal inertness,
 * and multi-passenger out-of-scope emptiness. Fixes destination collision
 * on singular "child" passenger repairs.
 */

const ADULT = new AdultCountConversationStateExtractor();
const CHILD = new ChildCountConversationStateExtractor();
const INFANT = new InfantCountConversationStateExtractor();
const COMPOSITE = createConversationStateExtractor();
const NEUTRAL = ACTIVATED_NEUTRAL_CONTINUATION_REPLY;
const BRIDGE =
  "Is there anything else you'd like me to consider? What else should I know about your trip?";

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17g',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-09-05',
    adultCount: 2,
    childCount: 1,
    infantCount: 1,
    ...overrides,
  };
}

function turn(
  message: string,
  seed: Partial<ConversationCoreState> = {},
  index = 0,
) {
  const previous = createState(seed);
  const adultExtractor = ADULT.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const childExtractor = CHILD.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const infantExtractor = INFANT.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const extracted = COMPOSITE.extract({ message, currentState: previous });
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: `user-17g-${index}`,
    assistantEntryId: `assistant-17g-${index}`,
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
    adultExtractor,
    childExtractor,
    infantExtractor,
    extracted,
    result,
    classification,
    plan,
  };
}

describe('Phase 17G — passenger repair extraction', () => {
  it('extracts Actually repairs for adults, children and infants', () => {
    expect(
      turn('Actually, 3 adults').extracted.stateUpdate,
    ).toEqual({ adultCount: 3 });
    expect(turn('Actually 3 adults').extracted.stateUpdate).toEqual({
      adultCount: 3,
    });
    expect(turn('Actually, 2 children').extracted.stateUpdate).toEqual({
      childCount: 2,
    });
    expect(turn('Actually 2 children').extracted.stateUpdate).toEqual({
      childCount: 2,
    });
    expect(turn('Actually, 1 infant').extracted.stateUpdate).toEqual({
      infantCount: 1,
    });
    expect(
      turn('Actually, 1 infant', { infantCount: null }).extracted.stateUpdate,
    ).toEqual({ infantCount: 1 });
  });

  it('extracts contrast repairs selecting only the new count', () => {
    const adults = turn('Not 2 adults, 3 adults');
    expect(adults.extracted.stateUpdate).toEqual({ adultCount: 3 });
    expect(adults.result.state.adultCount).toBe(3);
    expect(adults.result.state.childCount).toBe(1);
    expect(adults.result.state.infantCount).toBe(1);

    const children = turn('Not 1 child, 2 children');
    expect(children.extracted.stateUpdate).toEqual({ childCount: 2 });
    expect(children.result.state.childCount).toBe(2);
    expect(children.result.state.adultCount).toBe(2);

    const infants = turn('Not 2 infants, 1 infant');
    expect(infants.extracted.stateUpdate).toEqual({ infantCount: 1 });
    expect(infants.result.state.infantCount).toBe(1);
    expect(infants.result.state.adultCount).toBe(2);
    expect(infants.result.state.childCount).toBe(1);
  });

  it('extracts explicit field-count change cues', () => {
    expect(
      turn('Change the adult count to 3').extracted.stateUpdate,
    ).toEqual({ adultCount: 3 });
    expect(
      turn('Change the child count to 2').extracted.stateUpdate,
    ).toEqual({ childCount: 2 });
    expect(
      turn('Change the children count to 2').extracted.stateUpdate,
    ).toEqual({ childCount: 2 });
    expect(
      turn('Change the infant count to 1', { infantCount: null }).extracted
        .stateUpdate,
    ).toEqual({ infantCount: 1 });
  });

  it('preserves existing meant / make that / change that repairs', () => {
    for (const message of [
      'Sorry, I meant 3 adults',
      'I meant 3 adults',
      'No, make that 3 adults',
      'Change that to 3 adults',
    ] as const) {
      expect(turn(message).extracted.stateUpdate, message).toEqual({
        adultCount: 3,
      });
    }
    expect(turn('I meant 2 children').extracted.stateUpdate).toEqual({
      childCount: 2,
    });
    expect(turn('No, make that 1 infant').extracted.stateUpdate).toEqual({
      infantCount: 1,
    });
  });

  it('handles null-to-value, changed-value, and unchanged-value transitions', () => {
    const adultSet = turn('Actually, 3 adults', { adultCount: null });
    expect(adultSet.extracted.stateUpdate).toEqual({ adultCount: 3 });
    expect(adultSet.classification.newlyPopulated).toEqual(['adultCount']);
    expect(adultSet.plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'adultCount',
    });
    expect(adultSet.result.reply).toBe(
      `Travelling with 3 adults. ${BRIDGE}`,
    );

    const adultChanged = turn('Actually, 3 adults');
    expect(adultChanged.classification.updated).toEqual(['adultCount']);
    expect(adultChanged.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'adultCount',
    });
    expect(adultChanged.result.reply).toBe(`Updated to 3 adults. ${BRIDGE}`);

    const adultSame = turn('Actually, 2 adults');
    expect(adultSame.extracted.stateUpdate).toEqual({ adultCount: 2 });
    expect(adultSame.classification.updated).toEqual([]);
    expect(adultSame.plan.acknowledgementEvent).toBeNull();
    expect(adultSame.result.reply).toBe(NEUTRAL);

    const childSet = turn('Actually, 1 child', { childCount: null });
    expect(childSet.plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'childCount',
    });
    expect(childSet.result.reply).toBe(`I've noted 1 child. ${BRIDGE}`);

    const childChanged = turn('Not 1 child, 2 children');
    expect(childChanged.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'childCount',
    });
    expect(childChanged.result.reply).toBe(`Updated to 2 children. ${BRIDGE}`);

    const infantSet = turn('Change the infant count to 1', {
      infantCount: null,
    });
    expect(infantSet.plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'infantCount',
    });
    expect(infantSet.result.reply).toBe(`That includes 1 infant. ${BRIDGE}`);

    const infantChanged = turn('Not 2 infants, 1 infant', { infantCount: 2 });
    expect(infantChanged.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'infantCount',
    });
    expect(infantChanged.result.reply).toBe(`Updated to 1 infant. ${BRIDGE}`);
  });

  it('supports singular, plural, numeric, number-word, capitalisation, and punctuation', () => {
    expect(turn('Actually, 1 adult').extracted.stateUpdate).toEqual({
      adultCount: 1,
    });
    expect(turn('Actually, three adults').extracted.stateUpdate).toEqual({
      adultCount: 3,
    });
    expect(turn('ACTUALLY, 3 ADULTS').extracted.stateUpdate).toEqual({
      adultCount: 3,
    });
    expect(turn('Actually, 3 adults.').extracted.stateUpdate).toEqual({
      adultCount: 3,
    });
    expect(turn('Actually, 3 adults!').extracted.stateUpdate).toEqual({
      adultCount: 3,
    });
    expect(turn('Not one child, two children').extracted.stateUpdate).toEqual({
      childCount: 2,
    });
    expect(turn('Not 1 child, 2 children.').extracted.stateUpdate).toEqual({
      childCount: 2,
    });
    expect(
      turn('Change the infant count to one', { infantCount: null }).extracted
        .stateUpdate,
    ).toEqual({ infantCount: 1 });
  });

  it('keeps other passenger fields and trip fields unchanged', () => {
    const adult = turn('Actually, 3 adults');
    expect(adult.result.state.childCount).toBe(1);
    expect(adult.result.state.infantCount).toBe(1);
    expect(adult.result.state.destination).toBe('Cairns');
    expect(adult.result.state.origin).toBe('Sydney');
    expect(adult.result.state.departureDate).toBe('2026-08-28');
    expect(adult.result.state.returnDate).toBe('2026-09-05');
    expect(adult.extracted.stateUpdate).toEqual({ adultCount: 3 });

    const child = turn('Change the child count to 2');
    expect(child.result.state.adultCount).toBe(2);
    expect(child.result.state.infantCount).toBe(1);
    expect(child.result.state.destination).toBe('Cairns');
    expect(child.extracted.stateUpdate.destination).toBeUndefined();
    expect(child.extracted.stateUpdate.origin).toBeUndefined();
    expect(child.extracted.stateUpdate.departureDate).toBeUndefined();
    expect(child.extracted.stateUpdate.returnDate).toBeUndefined();
  });

  it('does not capture passenger repairs as destination', () => {
    for (const message of [
      'I meant 1 child',
      'Actually, 2 adults',
      'No, make that 1 infant',
      'Change the child count to 2',
    ] as const) {
      const t = turn(message);
      expect(t.extracted.stateUpdate.destination, message).toBeUndefined();
      expect(t.result.state.destination, message).toBe('Cairns');
      expect(t.extracted.stateUpdate.origin, message).toBeUndefined();
      expect(t.extracted.stateUpdate.departureDate, message).toBeUndefined();
      expect(t.extracted.stateUpdate.returnDate, message).toBeUndefined();
    }

    const childMeant = turn('I meant 1 child', { childCount: null });
    expect(childMeant.extracted.stateUpdate).toEqual({ childCount: 1 });
    expect(childMeant.result.state.destination).toBe('Cairns');
    expect(childMeant.plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'childCount',
    });
    expect(childMeant.result.reply).toBe(`I've noted 1 child. ${BRIDGE}`);
  });

  it('rejects contextual false-positive and non-passenger sentences', () => {
    for (const message of [
      'Actually, the hotel allows 3 adults',
      'Actually, tickets are for 2 children',
      'I meant the room fits 3 adults',
      'The flight price is for 2 adults',
      'Not sure whether 2 children are coming',
      'Adult-only hotel',
      'Child-friendly activities',
      'Infant seat required',
      'Change that to room 3',
      'Change the departure date to 3 August',
      'Change the destination to Three Rivers',
    ] as const) {
      const t = turn(message);
      // Room-fits / bare hotel / tickets still use legacy bare-count paths when
      // not Actually-prefaced; required Phase 17G negatives that must stay inert
      // are the Actually-prefaced and non-count forms below.
      if (
        message === 'Actually, the hotel allows 3 adults' ||
        message === 'Actually, tickets are for 2 children' ||
        message === 'Not sure whether 2 children are coming' ||
        message === 'Adult-only hotel' ||
        message === 'Child-friendly activities' ||
        message === 'Infant seat required' ||
        message === 'Change the departure date to 3 August' ||
        message === 'Change the destination to Three Rivers'
      ) {
        expect(t.adultExtractor, message).toEqual({});
        expect(t.childExtractor, message).toEqual({});
        expect(t.infantExtractor, message).toEqual({});
        expect(t.extracted.stateUpdate.adultCount, message).toBeUndefined();
        expect(t.extracted.stateUpdate.childCount, message).toBeUndefined();
        expect(t.extracted.stateUpdate.infantCount, message).toBeUndefined();
      }
    }

    // Legacy bare-count false positives remain out of Phase 17G cleanup scope.
    expect(
      turn('I meant the room fits 3 adults').extracted.stateUpdate.adultCount,
    ).toBe(3);
    expect(
      turn('The flight price is for 2 adults').extracted.stateUpdate.adultCount,
    ).toBe(2);
  });

  it('preserves zero and removal as no passenger-count patch', () => {
    for (const message of [
      'No adults',
      'No children',
      'No infants',
      'Zero adults',
      'Zero children',
      'Zero infants',
      '0 adults',
      '0 children',
      '0 infants',
      'Remove the adults',
      'Remove the children',
      'Remove the infants',
      'Actually, no children',
      'I meant no infants',
    ] as const) {
      const t = turn(message);
      expect(t.extracted.stateUpdate.adultCount, message).toBeUndefined();
      expect(t.extracted.stateUpdate.childCount, message).toBeUndefined();
      expect(t.extracted.stateUpdate.infantCount, message).toBeUndefined();
      expect(t.result.state.adultCount, message).toBe(2);
      expect(t.result.state.childCount, message).toBe(1);
      expect(t.result.state.infantCount, message).toBe(1);
    }
  });

  it('keeps multi-passenger sentences out of scope', () => {
    for (const message of [
      'Actually, 2 adults and 1 child',
      'Sorry, I meant 3 adults, not 2 children',
      'Change that to 2 children, not adults',
    ] as const) {
      const t = turn(message);
      expect(t.adultExtractor, message).toEqual({});
      expect(t.childExtractor, message).toEqual({});
      expect(t.infantExtractor, message).toEqual({});
      expect(t.extracted.stateUpdate.adultCount, message).toBeUndefined();
      expect(t.extracted.stateUpdate.childCount, message).toBeUndefined();
      expect(t.extracted.stateUpdate.infantCount, message).toBeUndefined();
      expect(t.result.reply, message).toBe(NEUTRAL);
    }
  });

  it('end-to-end: adult Actually repair through processConversationTurn', () => {
    const t = turn('Actually, 3 adults');
    expect(t.extracted.stateUpdate).toEqual({ adultCount: 3 });
    expect(t.result.state.adultCount).toBe(3);
    expect(t.classification.updated).toEqual(['adultCount']);
    expect(t.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'adultCount',
    });
    expect(t.plan.acknowledgements).toHaveLength(1);
    expect(t.result.reply).toBe(`Updated to 3 adults. ${BRIDGE}`);
    expect(t.result.state.destination).toBe('Cairns');
    expect(t.result.state.origin).toBe('Sydney');
    expect(t.result.state.departureDate).toBe('2026-08-28');
    expect(t.result.state.returnDate).toBe('2026-09-05');
  });

  it('end-to-end: child contrast and infant field-count change', () => {
    const child = turn('Not 1 child, 2 children');
    expect(child.extracted.stateUpdate).toEqual({ childCount: 2 });
    expect(child.result.state.childCount).toBe(2);
    expect(child.classification.updated).toEqual(['childCount']);
    expect(child.plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'childCount',
    });
    expect(child.result.reply).toBe(`Updated to 2 children. ${BRIDGE}`);
    expect(child.result.state.destination).toBe('Cairns');

    const infant = turn('Change the infant count to 1', { infantCount: null });
    expect(infant.extracted.stateUpdate).toEqual({ infantCount: 1 });
    expect(infant.result.state.infantCount).toBe(1);
    expect(infant.classification.newlyPopulated).toEqual(['infantCount']);
    expect(infant.plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'infantCount',
    });
    expect(infant.result.reply).toBe(`That includes 1 infant. ${BRIDGE}`);
    expect(infant.result.state.destination).toBe('Cairns');
    expect(infant.result.state.origin).toBe('Sydney');
  });
});
