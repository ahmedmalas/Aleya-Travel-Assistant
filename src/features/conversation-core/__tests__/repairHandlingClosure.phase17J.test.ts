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
 * Phase 17J — repair-handling closure audit.
 * Final closure evidence for Phases 17A–17I. Production code unchanged.
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

const BRIDGE =
  "Is there anything else you'd like me to consider? What else should I know about your trip?";

type ClosureTrace = {
  message: string;
  destinationExtractor: ConversationStateUpdate;
  originExtractor: ConversationStateUpdate;
  departureExtractor: ConversationStateUpdate;
  returnExtractor: ConversationStateUpdate;
  adultExtractor: ConversationStateUpdate;
  childExtractor: ConversationStateUpdate;
  infantExtractor: ConversationStateUpdate;
  extractedPatch: ConversationStateUpdate;
  final: ConversationCoreState;
  updated: readonly string[];
  newlyPopulated: readonly string[];
  hasRemovedProperty: boolean;
  acknowledgementEvent: unknown;
  acknowledgements: readonly string[];
  selectedFollowUp: string | null;
  exactFinalReply: string;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17j',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    destination: 'Melbourne',
    origin: 'Adelaide',
    departureDate: '2026-08-10',
    returnDate: '2026-09-01',
    adultCount: 2,
    childCount: 1,
    infantCount: 1,
    ...overrides,
  };
}

function trace(
  message: string,
  seed: Partial<ConversationCoreState> = {},
): ClosureTrace {
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
    userEntryId: 'user-17j',
    assistantEntryId: 'assistant-17j',
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
    final: result.state,
    updated: classification.updated,
    newlyPopulated: classification.newlyPopulated,
    hasRemovedProperty: Object.prototype.hasOwnProperty.call(
      classification,
      'removed',
    ),
    acknowledgementEvent: plan.acknowledgementEvent,
    acknowledgements: plan.acknowledgements,
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

describe('Phase 17J — repair handling closure audit', () => {
  it('preserves extractor order, shallow later-wins merge, and no removed array', () => {
    const extractors = readExtractors(
      COMPOSITE as CompositeConversationStateExtractor,
    );
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(extractors[5]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(extractors[6]).toBeInstanceOf(ChildCountConversationStateExtractor);
    expect(extractors[7]).toBeInstanceOf(InfantCountConversationStateExtractor);

    const compositeSource = readFileSync(
      resolve(CORE_SRC, 'CompositeConversationStateExtractor.ts'),
      'utf8',
    );
    expect(compositeSource).toMatch(/Later extractors win/);
    expect(compositeSource).toMatch(/extractor\.extract\(input\)/);

    const classificationSource = readFileSync(
      resolve(CORE_SRC, 'classifyConversationStateChange.ts'),
      'utf8',
    );
    expect(classificationSource).not.toMatch(
      /removed:\s*readonly TravelCompareKey/,
    );
  });

  it('closes single-field set and changed repairs with Phase 16 acknowledgement wording', () => {
    const changed = [
      {
        message: 'Sorry, I meant Cairns',
        patch: { destination: 'Cairns' },
        eventField: 'destination',
        replyIncludes: 'Updated — Cairns it is.',
      },
      {
        message: 'Sorry, I meant from Brisbane',
        patch: { origin: 'Brisbane' },
        eventField: 'origin',
        replyIncludes: "We'll depart from Brisbane instead.",
      },
      {
        message: 'Actually, depart on 30 August 2026',
        patch: { departureDate: '2026-08-30' },
        eventField: 'departureDate',
        replyIncludes: 'Departure is now set for 2026-08-30.',
      },
      {
        message: 'Actually, return on 5 September 2026',
        patch: { returnDate: '2026-09-05' },
        eventField: 'returnDate',
        replyIncludes: 'Return is now set for 2026-09-05.',
      },
      {
        message: 'Actually, 3 adults',
        patch: { adultCount: 3 },
        eventField: 'adultCount',
        replyIncludes: 'Updated to 3 adults.',
      },
      {
        message: 'Not 1 child, 2 children',
        patch: { childCount: 2 },
        eventField: 'childCount',
        replyIncludes: 'Updated to 2 children.',
      },
      {
        message: 'Change the infant count to 2',
        patch: { infantCount: 2 },
        eventField: 'infantCount',
        replyIncludes: 'Updated to 2 infants.',
      },
    ] as const;

    for (const entry of changed) {
      const t = trace(entry.message);
      expect(t.extractedPatch, entry.message).toEqual(entry.patch);
      expect(t.updated, entry.message).toEqual([entry.eventField]);
      expect(t.acknowledgementEvent, entry.message).toEqual({
        kind: 'field-changed',
        field: entry.eventField,
      });
      expect(t.acknowledgements, entry.message).toHaveLength(1);
      expect(t.exactFinalReply, entry.message).toContain(entry.replyIncludes);
      expect(t.exactFinalReply, entry.message).toContain(BRIDGE);
      expect(t.hasRemovedProperty, entry.message).toBe(false);
    }

    const setCases = [
      {
        message: 'Sorry, I meant Cairns',
        seed: { destination: null },
        eventField: 'destination',
        replyIncludes: 'Great, Cairns it is.',
      },
      {
        message: 'Sorry, I meant from Brisbane',
        seed: { origin: null },
        eventField: 'origin',
        replyIncludes: "We'll start from Brisbane.",
      },
      {
        message: 'Actually, depart on 30 August 2026',
        seed: { departureDate: null },
        eventField: 'departureDate',
        replyIncludes: 'Departure is set for 2026-08-30.',
      },
      {
        message: 'Actually, return on 5 September 2026',
        seed: { returnDate: null },
        eventField: 'returnDate',
        replyIncludes: 'Return is set for 2026-09-05.',
      },
      {
        message: 'Actually, 3 adults',
        seed: { adultCount: null },
        eventField: 'adultCount',
        replyIncludes: 'Travelling with 3 adults.',
      },
      {
        message: 'Actually, 2 children',
        seed: { childCount: null },
        eventField: 'childCount',
        replyIncludes: "I've noted 2 children.",
      },
      {
        message: 'Change the infant count to 1',
        seed: { infantCount: null },
        eventField: 'infantCount',
        replyIncludes: 'That includes 1 infant.',
      },
    ] as const;

    for (const entry of setCases) {
      const t = trace(entry.message, entry.seed);
      expect(t.newlyPopulated, entry.message).toEqual([entry.eventField]);
      expect(t.acknowledgementEvent, entry.message).toEqual({
        kind: 'field-set',
        field: entry.eventField,
      });
      expect(t.exactFinalReply, entry.message).toContain(entry.replyIncludes);
    }

    // Unchanged-value repairs emit patch but no acknowledgement event.
    const sameDest = trace('Sorry, I meant Cairns', { destination: 'Cairns' });
    expect(sameDest.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(sameDest.updated).toEqual([]);
    expect(sameDest.acknowledgementEvent).toBeNull();
    expect(sameDest.acknowledgements).toEqual([]);

    const sameAdults = trace('Actually, 2 adults');
    expect(sameAdults.extractedPatch).toEqual({ adultCount: 2 });
    expect(sameAdults.updated).toEqual([]);
    expect(sameAdults.acknowledgementEvent).toBeNull();
  });

  it('closes multi-fact place-boundary journeys with clean values and one acknowledgement', () => {
    const primary = trace(
      'Sorry, I meant Cairns, leaving from Sydney on 28 August 2026',
      { departureDate: null },
    );
    expect(primary.destinationExtractor).toEqual({ destination: 'Cairns' });
    expect(primary.originExtractor).toEqual({ origin: 'Sydney' });
    expect(primary.departureExtractor).toEqual({
      departureDate: '2026-08-28',
    });
    expect(primary.extractedPatch).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    expect(primary.final.destination).toBe('Cairns');
    expect(primary.final.origin).toBe('Sydney');
    expect(primary.final.departureDate).toBe('2026-08-28');
    expect(primary.final.origin).not.toMatch(/on 28 August|leaving|departing/);
    expect(primary.acknowledgements).toHaveLength(1);
    expect(primary.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(primary.exactFinalReply).toBe(
      `Updated — Cairns it is. ${BRIDGE}`,
    );

    for (const message of [
      'I meant Cairns, from Sydney',
      'Actually, Cairns, departing from Sydney',
      'Not Melbourne, Cairns, from Sydney',
    ] as const) {
      const t = trace(message);
      expect(t.extractedPatch, message).toEqual({
        destination: 'Cairns',
        origin: 'Sydney',
      });
      expect(t.acknowledgements, message).toHaveLength(1);
      expect(t.acknowledgementEvent, message).toEqual({
        kind: 'field-changed',
        field: 'destination',
      });
      expect(t.exactFinalReply, message).toContain('Updated — Cairns it is.');
    }

    const originDate = trace(
      'Sorry, I meant from Sydney, leaving on 28 August 2026',
      { departureDate: null },
    );
    expect(originDate.extractedPatch).toEqual({
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    expect(originDate.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });

    const destAdults = trace('I meant Cairns, 3 adults');
    expect(destAdults.extractedPatch).toEqual({
      destination: 'Cairns',
      adultCount: 3,
    });
    expect(destAdults.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });

    const originAdults = trace('Actually, from Sydney, 2 adults');
    expect(originAdults.extractedPatch).toEqual({
      origin: 'Sydney',
      adultCount: 2,
    });
    expect(originAdults.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
  });

  it('proves final ownership rules for bare place, from-cues, dates, and passengers', () => {
    const barePlace = trace('I meant Hobart', {
      destination: 'Melbourne',
      origin: null,
    });
    expect(barePlace.extractedPatch).toEqual({ destination: 'Hobart' });
    expect(barePlace.final.origin).toBeNull();

    const fromCue = trace('I meant from Hobart', {
      destination: 'Cairns',
      origin: 'Sydney',
    });
    expect(fromCue.extractedPatch).toEqual({ origin: 'Hobart' });
    expect(fromCue.final.destination).toBe('Cairns');

    const bareDate = trace('I meant 30 August 2026');
    expect(bareDate.extractedPatch).toEqual({});
    expect(bareDate.final.departureDate).toBe('2026-08-10');
    expect(bareDate.final.returnDate).toBe('2026-09-01');

    const actuallyBareDate = trace('Actually, 28 August 2026');
    expect(actuallyBareDate.extractedPatch).toEqual({});

    expect(
      trace('Actually, depart on 30 August 2026').extractedPatch,
    ).toEqual({ departureDate: '2026-08-30' });
    expect(
      trace('Actually, return on 5 September 2026').extractedPatch,
    ).toEqual({ returnDate: '2026-09-05' });
    expect(trace('Actually, 3 adults').extractedPatch).toEqual({
      adultCount: 3,
    });
    expect(trace('Not 1 child, 2 children').extractedPatch).toEqual({
      childCount: 2,
    });
    expect(trace('Change the infant count to 2').extractedPatch).toEqual({
      infantCount: 2,
    });
  });

  it('preserves intentional limitations and unsupported/ambiguous repairs', () => {
    // Phase 19L accepts whole-message "No children"; keep adult-zero and
    // repair/ambiguous limitations locked here.
    for (const message of [
      '0 adults',
      'Zero children',
      'Actually, no children',
      'Actually, 2 adults and 1 child',
      'Sorry, I meant somewhere',
      'I meant Cairns or Hobart',
      'asdfgh nonsense',
    ] as const) {
      const t = trace(message);
      expect(t.extractedPatch, message).toEqual({});
      expect(t.acknowledgementEvent, message).toBeNull();
    }

    // No-year: place may clean; departure remains governed by existing policy.
    const noYear = trace('Sorry, I meant Cairns, leaving on 28 August', {
      departureDate: null,
    });
    expect(noYear.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(noYear.final.departureDate).toBeNull();
  });

  it('preserves ordinary non-repair extraction and conversational-layer isolation', () => {
    expect(trace('Go to Cairns', { destination: null }).extractedPatch).toEqual(
      { destination: 'Cairns' },
    );
    expect(trace('From Sydney', { origin: null }).extractedPatch).toEqual({
      origin: 'Sydney',
    });
    expect(
      trace('Depart on 28 August 2026', { departureDate: null }).extractedPatch,
    ).toEqual({ departureDate: '2026-08-28' });
    expect(
      trace('Return on 2 September 2026', { returnDate: null }).extractedPatch,
    ).toEqual({ returnDate: '2026-09-02' });
    expect(trace('3 adults', { adultCount: null }).extractedPatch).toEqual({
      adultCount: 3,
    });
    expect(trace('2 children', { childCount: null }).extractedPatch).toEqual({
      childCount: 2,
    });
    expect(trace('1 infant', { infantCount: null }).extractedPatch).toEqual({
      infantCount: 1,
    });

    // Conversational selection/transform layers remain free of repair parsing.
    for (const file of [
      'createConversationReplyPlan.ts',
      'assembleConversationReplyPlan.ts',
      'transformBaselineAcknowledgement.ts',
      'selectConversationAcknowledgement.ts',
    ] as const) {
      const source = readFileSync(resolve(CORE_SRC, file), 'utf8');
      expect(source, file).not.toMatch(/\bi\s+meant\b/i);
      expect(source, file).not.toMatch(/\bactually,\s+/i);
      expect(source, file).not.toMatch(/Not Melbourne/);
    }
  });

  it('documents Phase 17J closure audit artifact and closure decision A', () => {
    const audit = readFileSync(
      resolve(
        ROOT,
        'docs/conversation-engine/phase17-repair-handling-closure-audit.md',
      ),
      'utf8',
    );
    expect(audit).toMatch(/# Phase 17 Repair Handling Closure Audit/);
    expect(audit).toMatch(/## Closure Decision/);
    expect(audit).toMatch(
      /Phase 17 repair handling is complete and should close/,
    );
    expect(audit).toMatch(/## Recommended Phase 18 Boundary/);
    expect(audit).toMatch(/Sorry, I meant Cairns, leaving from Sydney/);
  });
});
