import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

/**
 * Phase 17H — multi-fact repair extraction characterization.
 * Documents current (including defective) behaviour only.
 * Production code is unchanged.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const COMPOSITE = createConversationStateExtractor();
const DEST = new DestinationConversationStateExtractor();
const ORIGIN = new OriginConversationStateExtractor();
const DEPART = new DepartureDateConversationStateExtractor();
const RETURN = new ReturnDateConversationStateExtractor();
const ADULT = new AdultCountConversationStateExtractor();
const CHILD = new ChildCountConversationStateExtractor();
const INFANT = new InfantCountConversationStateExtractor();

type MultiFactTrace = {
  message: string;
  destinationExtractor: ConversationStateUpdate;
  originExtractor: ConversationStateUpdate;
  departureExtractor: ConversationStateUpdate;
  returnExtractor: ConversationStateUpdate;
  adultExtractor: ConversationStateUpdate;
  childExtractor: ConversationStateUpdate;
  infantExtractor: ConversationStateUpdate;
  extractedPatch: ConversationStateUpdate;
  finalDestination: string | null;
  finalOrigin: string | null;
  finalDepartureDate: string | null;
  finalReturnDate: string | null;
  finalAdultCount: number | null;
  finalChildCount: number | null;
  finalInfantCount: number | null;
  updated: readonly string[];
  newlyPopulated: readonly string[];
  hasRemovedProperty: boolean;
  selectedAcknowledgement: string | null;
  acknowledgementEvent: unknown;
  selectedFollowUp: string | null;
  exactFinalReply: string;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17h',
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

function trace(
  message: string,
  seed: Partial<ConversationCoreState> = {},
): MultiFactTrace {
  const previous = createState(seed);
  const input = { message, currentState: previous };
  const destinationExtractor = DEST.extract(input).stateUpdate;
  const originExtractor = ORIGIN.extract(input).stateUpdate;
  const departureExtractor = DEPART.extract(input).stateUpdate;
  const returnExtractor = RETURN.extract(input).stateUpdate;
  const adultExtractor = ADULT.extract(input).stateUpdate;
  const childExtractor = CHILD.extract(input).stateUpdate;
  const infantExtractor = INFANT.extract(input).stateUpdate;
  const extracted = COMPOSITE.extract(input);
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-17h',
    assistantEntryId: 'assistant-17h',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
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
    message,
    destinationExtractor,
    originExtractor,
    departureExtractor,
    returnExtractor,
    adultExtractor,
    childExtractor,
    infantExtractor,
    extractedPatch: extracted.stateUpdate,
    finalDestination: result.state.destination,
    finalOrigin: result.state.origin,
    finalDepartureDate: result.state.departureDate,
    finalReturnDate: result.state.returnDate,
    finalAdultCount: result.state.adultCount,
    finalChildCount: result.state.childCount,
    finalInfantCount: result.state.infantCount,
    updated: classification.updated,
    newlyPopulated: classification.newlyPopulated,
    hasRemovedProperty: Object.prototype.hasOwnProperty.call(
      classification,
      'removed',
    ),
    selectedAcknowledgement:
      plan.acknowledgements.length === 1 ? plan.acknowledgements[0]! : null,
    acknowledgementEvent: plan.acknowledgementEvent,
    // Continuation is folded into followUpQuestion by assembleConversationReplyPlan.
    selectedFollowUp: plan.followUpQuestion,
    exactFinalReply: result.reply,
  };
}

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly unknown[] {
  return (
    composite as unknown as {
      extractors: readonly unknown[];
    }
  ).extractors;
}

describe('Phase 17H — multi-fact repair extraction audit', () => {
  it('documents extractor order, full-message input, and later-wins patch merge', () => {
    const extractors = readExtractors(
      COMPOSITE as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(28);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(extractors[4]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(extractors[5]).toBeInstanceOf(ChildCountConversationStateExtractor);
    expect(extractors[6]).toBeInstanceOf(InfantCountConversationStateExtractor);

    const compositeSource = readFileSync(
      resolve(CORE_SRC, 'CompositeConversationStateExtractor.ts'),
      'utf8',
    );
    expect(compositeSource).toMatch(/Later extractors win/);
    expect(compositeSource).toMatch(/\.\.\.accumulatedStateUpdate/);
    expect(compositeSource).toMatch(/\.\.\.result\.stateUpdate/);
    // Each extractor receives the original input.message — no rewriting.
    expect(compositeSource).toMatch(/extractor\.extract\(input\)/);
    expect(compositeSource).not.toMatch(/input\.message\s*=/);

    // Classification still has no removed array.
    const classificationSource = readFileSync(
      resolve(CORE_SRC, 'classifyConversationStateChange.ts'),
      'utf8',
    );
    expect(classificationSource).not.toMatch(
      /removed:\s*readonly TravelCompareKey/,
    );
  });

  it('primary three-field case: destination missed; origin polluted; departure set with year', () => {
    const t = trace(
      'Sorry, I meant Cairns, leaving from Sydney on 28 August 2026',
    );
    expect(t.destinationExtractor).toEqual({});
    expect(t.originExtractor).toEqual({
      origin: 'Sydney on 28 August 2026',
    });
    expect(t.departureExtractor).toEqual({ departureDate: '2026-08-28' });
    expect(t.returnExtractor).toEqual({});
    expect(t.extractedPatch).toEqual({
      origin: 'Sydney on 28 August 2026',
      departureDate: '2026-08-28',
    });
    expect(t.finalDestination).toBe('Melbourne');
    expect(t.finalOrigin).toBe('Sydney on 28 August 2026');
    expect(t.finalDepartureDate).toBe('2026-08-28');
    expect(t.updated).toEqual(['origin']);
    expect(t.newlyPopulated).toEqual(['departureDate']);
    expect(t.hasRemovedProperty).toBe(false);
    expect(t.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
    expect(t.selectedAcknowledgement).toBe(
      'Perfect — departing from Sydney on 28 August 2026.',
    );
    expect(t.selectedFollowUp).toBe('When would you like to return?');
    expect(t.exactFinalReply).toBe(
      "We'll depart from Sydney on 28 August 2026 instead. When would you like to return?",
    );
  });

  it('destination + origin: most leaving/departing forms miss destination; bare from can dual-extract', () => {
    const leaving = [
      'Sorry, I meant Cairns, leaving from Sydney',
      'Actually, Cairns, departing from Sydney',
      'No, make that Cairns, leaving from Sydney',
      'Change that to Cairns, departing from Sydney',
    ] as const;
    for (const message of leaving) {
      const t = trace(message);
      expect(t.destinationExtractor, message).toEqual({});
      expect(t.originExtractor, message).toEqual({ origin: 'Sydney' });
      expect(t.extractedPatch, message).toEqual({ origin: 'Sydney' });
      expect(t.finalDestination, message).toBe('Melbourne');
      expect(t.finalOrigin, message).toBe('Sydney');
      expect(t.acknowledgementEvent, message).toEqual({
        kind: 'field-changed',
        field: 'origin',
      });
      expect(t.exactFinalReply, message).toBe(
        "We'll depart from Sydney instead. When would you like to depart?",
      );
    }

    // Comma + bare "from" lets destination strip the from-clause cleanly.
    const bareFrom = trace('I meant Cairns, from Sydney');
    expect(bareFrom.destinationExtractor).toEqual({ destination: 'Cairns' });
    expect(bareFrom.originExtractor).toEqual({ origin: 'Sydney' });
    expect(bareFrom.extractedPatch).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
    });
    expect(bareFrom.finalDestination).toBe('Cairns');
    expect(bareFrom.finalOrigin).toBe('Sydney');
    expect(bareFrom.updated).toEqual(['destination', 'origin']);
    expect(bareFrom.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(bareFrom.exactFinalReply).toBe(
      'Updated — Cairns it is. When would you like to depart?',
    );

    // Contrast destination succeeds; trailing "from Sydney" is not origin-owned.
    const contrast = trace('Not Melbourne, Cairns, from Sydney');
    expect(contrast.destinationExtractor).toEqual({ destination: 'Cairns' });
    expect(contrast.originExtractor).toEqual({});
    expect(contrast.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(contrast.finalOrigin).toBe('Adelaide');
    expect(contrast.exactFinalReply).toBe(
      'Updated — Cairns it is. When would you like to depart?',
    );
  });

  it('destination + departure: with-year sets date only; destination missed; contrast+date empty', () => {
    for (const message of [
      'Sorry, I meant Cairns, leaving on 28 August 2026',
      'I meant Cairns, depart on 28 August 2026',
      'Actually, Cairns, departure is 28 August 2026',
      'No, make that Cairns, leaving on 28 August 2026',
    ] as const) {
      const t = trace(message);
      expect(t.destinationExtractor, message).toEqual({});
      expect(t.departureExtractor, message).toEqual({
        departureDate: '2026-08-28',
      });
      expect(t.extractedPatch, message).toEqual({
        departureDate: '2026-08-28',
      });
      expect(t.finalDestination, message).toBe('Melbourne');
      expect(t.newlyPopulated, message).toEqual(['departureDate']);
      expect(t.acknowledgementEvent, message).toEqual({
        kind: 'field-set',
        field: 'departureDate',
      });
      expect(t.exactFinalReply, message).toBe(
        'Departure is set for 2026-08-28. When would you like to return?',
      );
    }

    const contrastDate = trace(
      'Not Melbourne, Cairns, departing on 28 August 2026',
    );
    expect(contrastDate.destinationExtractor).toEqual({});
    expect(contrastDate.departureExtractor).toEqual({});
    expect(contrastDate.extractedPatch).toEqual({});
    expect(contrastDate.finalDestination).toBe('Melbourne');
    expect(contrastDate.acknowledgementEvent).toBeNull();
  });

  it('no-year dates fail because departure parsing requires YYYY, not multi-fact wording alone', () => {
    expect(
      DEPART.extract({
        message: 'leaving on 28 August',
        currentState: createState(),
      }).stateUpdate,
    ).toEqual({});
    expect(
      DEPART.extract({
        message: 'leaving on 28 August 2026',
        currentState: createState(),
      }).stateUpdate,
    ).toEqual({ departureDate: '2026-08-28' });

    for (const message of [
      'Sorry, I meant Cairns, leaving on 28 August',
      'Actually, Cairns, departing on 28 August',
      'Sorry, I meant Cairns, leaving from Sydney on 28 August',
    ] as const) {
      const t = trace(message);
      expect(t.departureExtractor, message).toEqual({});
      expect(t.extractedPatch.departureDate, message).toBeUndefined();
    }

    // Without year, three-field collapses to polluted origin only.
    const three = trace(
      'Sorry, I meant Cairns, leaving from Sydney on 28 August',
    );
    expect(three.destinationExtractor).toEqual({});
    expect(three.originExtractor).toEqual({ origin: 'Sydney on 28 August' });
    expect(three.extractedPatch).toEqual({ origin: 'Sydney on 28 August' });
    expect(three.finalDestination).toBe('Melbourne');
    expect(three.exactFinalReply).toBe(
      "We'll depart from Sydney on 28 August instead. When would you like to depart?",
    );
  });

  it('origin + departure: origin absorbs trailing departure/date text; some conjunction forms miss both', () => {
    const meantFrom = trace(
      'Sorry, I meant from Sydney, leaving on 28 August 2026',
    );
    expect(meantFrom.originExtractor).toEqual({
      origin: 'Sydney, leaving on 28 August 2026',
    });
    expect(meantFrom.departureExtractor).toEqual({
      departureDate: '2026-08-28',
    });
    expect(meantFrom.extractedPatch).toEqual({
      origin: 'Sydney, leaving on 28 August 2026',
      departureDate: '2026-08-28',
    });
    expect(meantFrom.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
    expect(meantFrom.exactFinalReply).toBe(
      "We'll depart from Sydney, leaving on 28 August 2026 instead. When would you like to return?",
    );

    const actuallyFrom = trace(
      'Actually, from Sydney, depart on 28 August 2026',
    );
    expect(actuallyFrom.originExtractor).toEqual({
      origin: 'Sydney, depart on 28 August 2026',
    });
    expect(actuallyFrom.departureExtractor).toEqual({
      departureDate: '2026-08-28',
    });

    // "and" inside change-the-origin capture is rejected; departure cue never fires.
    const conjunction = trace(
      'Change the origin to Sydney and departure date to 28 August 2026',
    );
    expect(conjunction.originExtractor).toEqual({});
    expect(conjunction.departureExtractor).toEqual({});
    expect(conjunction.extractedPatch).toEqual({});
    expect(conjunction.acknowledgementEvent).toBeNull();

    // "from X instead" truncates before leaving-clause; departure remains blocked/missed.
    const instead = trace('From Sydney instead, leaving on 28 August 2026');
    expect(instead.originExtractor).toEqual({ origin: 'Sydney' });
    expect(instead.departureExtractor).toEqual({});
    expect(instead.extractedPatch).toEqual({ origin: 'Sydney' });
    expect(instead.exactFinalReply).toBe(
      "We'll depart from Sydney instead. When would you like to depart?",
    );
  });

  it('three-field variants: destination usually missed; origin polluted; departure conditional', () => {
    const actually = trace(
      'Actually, Cairns, departing from Sydney on 28 August 2026',
    );
    expect(actually.destinationExtractor).toEqual({});
    expect(actually.originExtractor).toEqual({
      origin: 'Sydney on 28 August 2026',
    });
    // Departure cue blocked when "actually" is present without an explicit
    // departure-repair preface that carves out the actually-block.
    expect(actually.departureExtractor).toEqual({});
    expect(actually.extractedPatch).toEqual({
      origin: 'Sydney on 28 August 2026',
    });
    expect(actually.finalDestination).toBe('Melbourne');
    expect(actually.exactFinalReply).toBe(
      "We'll depart from Sydney on 28 August 2026 instead. When would you like to depart?",
    );

    const changeThat = trace(
      'Change that to Cairns, from Sydney, departing on 28 August 2026',
    );
    expect(changeThat.destinationExtractor).toEqual({});
    expect(changeThat.originExtractor).toEqual({
      origin: 'Sydney, departing on 28 August 2026',
    });
    expect(changeThat.departureExtractor).toEqual({
      departureDate: '2026-08-28',
    });
    expect(changeThat.extractedPatch).toEqual({
      origin: 'Sydney, departing on 28 August 2026',
      departureDate: '2026-08-28',
    });

    const contrast = trace(
      'Not Melbourne, Cairns, from Sydney on 28 August 2026',
    );
    expect(contrast.destinationExtractor).toEqual({ destination: 'Cairns' });
    expect(contrast.originExtractor).toEqual({});
    expect(contrast.departureExtractor).toEqual({});
    expect(contrast.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(contrast.finalOrigin).toBe('Adelaide');
    expect(contrast.finalDepartureDate).toBeNull();
  });

  it('passenger combinations: passenger may win alone, pollute origin, or be suppressed by not', () => {
    const destAdults = trace('Sorry, I meant Cairns, 3 adults');
    expect(destAdults.destinationExtractor).toEqual({});
    expect(destAdults.adultExtractor).toEqual({ adultCount: 3 });
    expect(destAdults.extractedPatch).toEqual({ adultCount: 3 });
    expect(destAdults.finalDestination).toBe('Melbourne');
    expect(destAdults.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'adultCount',
    });
    expect(destAdults.exactFinalReply).toBe(
      'Updated to 3 adults. When would you like to depart?',
    );

    const originAdults = trace('Actually, from Sydney, 2 adults');
    expect(originAdults.originExtractor).toEqual({
      origin: 'Sydney, 2 adults',
    });
    // Whole-message Actually passenger repair does not match; actually-block wins.
    expect(originAdults.adultExtractor).toEqual({});
    expect(originAdults.extractedPatch).toEqual({
      origin: 'Sydney, 2 adults',
    });
    expect(originAdults.finalAdultCount).toBe(2);
    expect(originAdults.exactFinalReply).toBe(
      "We'll depart from Sydney, 2 adults instead. When would you like to depart?",
    );

    const destChildren = trace('Change that to Cairns, 2 children');
    expect(destChildren.destinationExtractor).toEqual({});
    expect(destChildren.childExtractor).toEqual({ childCount: 2 });
    expect(destChildren.extractedPatch).toEqual({ childCount: 2 });
    expect(destChildren.newlyPopulated).toEqual(['childCount']);
    expect(destChildren.exactFinalReply).toBe(
      "I've noted 2 children. When would you like to depart?",
    );

    const contrastInfant = trace('Not Melbourne, Cairns, with 1 infant');
    expect(contrastInfant.destinationExtractor).toEqual({
      destination: 'Cairns',
    });
    // Infant extractor still hard-blocks \\bnot\\b outside its own contrast form.
    expect(contrastInfant.infantExtractor).toEqual({});
    expect(contrastInfant.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(contrastInfant.finalInfantCount).toBeNull();

    const originAdultsDate = trace(
      'Sorry, I meant from Sydney, 3 adults, leaving on 28 August 2026',
    );
    expect(originAdultsDate.originExtractor).toEqual({
      origin: 'Sydney, 3 adults, leaving on 28 August 2026',
    });
    expect(originAdultsDate.adultExtractor).toEqual({ adultCount: 3 });
    expect(originAdultsDate.departureExtractor).toEqual({
      departureDate: '2026-08-28',
    });
    expect(originAdultsDate.extractedPatch).toEqual({
      origin: 'Sydney, 3 adults, leaving on 28 August 2026',
      departureDate: '2026-08-28',
      adultCount: 3,
    });
    expect(originAdultsDate.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
    expect(originAdultsDate.exactFinalReply).toBe(
      "We'll depart from Sydney, 3 adults, leaving on 28 August 2026 instead. When would you like to return?",
    );
  });

  it('punctuation and conjunction change destination ownership and pollution', () => {
    const commaFrom = trace('I meant Cairns, from Sydney');
    expect(commaFrom.extractedPatch).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
    });

    const spaceFrom = trace('I meant Cairns from Sydney');
    expect(spaceFrom.extractedPatch).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
    });

    const andFrom = trace('I meant Cairns and from Sydney');
    // Destination rejects captures containing "and"; origin still takes Sydney.
    expect(andFrom.destinationExtractor).toEqual({});
    expect(andFrom.originExtractor).toEqual({ origin: 'Sydney' });
    expect(andFrom.extractedPatch).toEqual({ origin: 'Sydney' });

    const semicolon = trace('I meant Cairns; from Sydney');
    expect(semicolon.extractedPatch).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
    });

    const dash = trace('I meant Cairns — from Sydney');
    // Em-dash is not stripped; destination capture is polluted.
    expect(dash.destinationExtractor).toEqual({ destination: 'Cairns —' });
    expect(dash.originExtractor).toEqual({ origin: 'Sydney' });
    expect(dash.extractedPatch).toEqual({
      destination: 'Cairns —',
      origin: 'Sydney',
    });
    expect(dash.exactFinalReply).toContain('Updated — Cairns — it is.');

    const leaving = trace('I meant Cairns, leaving from Sydney');
    expect(leaving.destinationExtractor).toEqual({});
    expect(leaving.originExtractor).toEqual({ origin: 'Sydney' });

    const andLeaving = trace('I meant Cairns and leaving from Sydney');
    expect(andLeaving.destinationExtractor).toEqual({});
    expect(andLeaving.originExtractor).toEqual({ origin: 'Sydney' });
  });

  it('previous-state scenarios: classification distinguishes set/changed/unchanged on emitted patches', () => {
    const message =
      'Sorry, I meant Cairns, leaving from Sydney on 28 August 2026';

    const allPopulated = trace(message, {
      destination: 'Melbourne',
      origin: 'Adelaide',
      departureDate: '2026-08-10',
      returnDate: '2026-09-05',
    });
    expect(allPopulated.extractedPatch).toEqual({
      origin: 'Sydney on 28 August 2026',
      departureDate: '2026-08-28',
    });
    expect(allPopulated.updated).toEqual(['origin', 'departureDate']);
    expect(allPopulated.newlyPopulated).toEqual([]);
    expect(allPopulated.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
    expect(allPopulated.exactFinalReply).toBe(
      "We'll depart from Sydney on 28 August 2026 instead. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );

    const allNull = trace(message, {
      destination: null,
      origin: null,
      departureDate: null,
      returnDate: null,
    });
    expect(allNull.finalDestination).toBeNull();
    expect(allNull.newlyPopulated).toEqual(['origin', 'departureDate']);
    expect(allNull.updated).toEqual([]);
    expect(allNull.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'origin',
    });
    expect(allNull.exactFinalReply).toBe(
      "We'll start from Sydney on 28 August 2026. Where would you like to travel?",
    );

    const onlyDest = trace(message, {
      destination: 'Melbourne',
      origin: null,
      departureDate: null,
    });
    expect(onlyDest.newlyPopulated).toEqual(['origin', 'departureDate']);
    expect(onlyDest.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'origin',
    });

    const onlyOrigin = trace(message, {
      destination: null,
      origin: 'Adelaide',
      departureDate: null,
    });
    expect(onlyOrigin.updated).toEqual(['origin']);
    expect(onlyOrigin.newlyPopulated).toEqual(['departureDate']);

    // Equal clean dual extract → patch emitted, classification unchanged.
    const equalClean = trace('I meant Cairns, from Sydney', {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: null,
    });
    expect(equalClean.extractedPatch).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
    });
    expect(equalClean.updated).toEqual([]);
    expect(equalClean.newlyPopulated).toEqual([]);
    expect(equalClean.acknowledgementEvent).toBeNull();

    // One field changes while another is equal but polluted string differs.
    const equalOriginName = trace(message, {
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: null,
    });
    expect(equalOriginName.updated).toEqual(['origin']);
    expect(equalOriginName.newlyPopulated).toEqual(['departureDate']);
    expect(equalOriginName.finalOrigin).toBe('Sydney on 28 August 2026');
  });

  it('proves pollution originates inside extractors, not patch assembly overwrite', () => {
    const message =
      'Sorry, I meant Cairns, leaving from Sydney on 28 August 2026';
    const t = trace(message);
    // Origin extractor alone emits the polluted value before merge.
    expect(t.originExtractor).toEqual({
      origin: 'Sydney on 28 August 2026',
    });
    expect(t.destinationExtractor).toEqual({});
    expect(t.departureExtractor).toEqual({ departureDate: '2026-08-28' });
    // Composite is the union of individual patches — no field rewrite.
    expect(t.extractedPatch).toEqual({
      ...t.destinationExtractor,
      ...t.originExtractor,
      ...t.departureExtractor,
      ...t.returnExtractor,
      ...t.adultExtractor,
      ...t.childExtractor,
      ...t.infantExtractor,
    });
    // Later extractors do not overwrite origin with a clean value.
    expect(t.extractedPatch.origin).toBe(t.originExtractor.origin);
  });

  it('documents Phase 17H audit artifact', () => {
    const audit = readFileSync(
      resolve(ROOT, 'docs/conversation-engine/phase17-multi-fact-repair-audit.md'),
      'utf8',
    );
    expect(audit).toMatch(/# Phase 17 Multi-Fact Repair Audit/);
    expect(audit).toMatch(/## Recommended Phase 17I/);
    expect(audit).toMatch(/Sydney on 28 August 2026/);
    expect(audit).toMatch(/Later extractors win/);
  });
});
