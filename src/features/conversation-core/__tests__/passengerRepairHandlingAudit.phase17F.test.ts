import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  type ConversationStateUpdate,
} from '../index';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';

/**
 * Phase 17F — passenger-count repair handling characterization.
 * Documents current (including defective) behaviour only.
 * Production code is unchanged.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const COMPOSITE = createConversationStateExtractor();
const ADULT = new AdultCountConversationStateExtractor();
const CHILD = new ChildCountConversationStateExtractor();
const INFANT = new InfantCountConversationStateExtractor();
const NEUTRAL = ACTIVATED_NEUTRAL_CONTINUATION_REPLY;

type PassengerTrace = {
  message: string;
  extractedPatch: ConversationStateUpdate;
  adultExtractor: ConversationStateUpdate;
  childExtractor: ConversationStateUpdate;
  infantExtractor: ConversationStateUpdate;
  finalAdultCount: number | null;
  finalChildCount: number | null;
  finalInfantCount: number | null;
  updated: readonly string[];
  newlyPopulated: readonly string[];
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
      conversationId: 'conversation-17f',
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

function trace(
  message: string,
  seed: Partial<ConversationCoreState> = {},
): PassengerTrace {
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
    userEntryId: 'user-17f',
    assistantEntryId: 'assistant-17f',
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
    extractedPatch: extracted.stateUpdate,
    adultExtractor,
    childExtractor,
    infantExtractor,
    finalAdultCount: result.state.adultCount,
    finalChildCount: result.state.childCount,
    finalInfantCount: result.state.infantCount,
    updated: classification.updated,
    newlyPopulated: classification.newlyPopulated,
    selectedAcknowledgement:
      plan.acknowledgements.length === 1 ? plan.acknowledgements[0]! : null,
    acknowledgementEvent: plan.acknowledgementEvent,
    selectedFollowUp: plan.followUpQuestion,
    exactFinalReply: result.reply,
  };
}

describe('Phase 17F — passenger repair handling audit', () => {
  it('documents separate passenger extractors with shared guard patterns', () => {
    const adult = readFileSync(
      resolve(CORE_SRC, 'AdultCountConversationStateExtractor.ts'),
      'utf8',
    );
    const child = readFileSync(
      resolve(CORE_SRC, 'ChildCountConversationStateExtractor.ts'),
      'utf8',
    );
    const infant = readFileSync(
      resolve(CORE_SRC, 'InfantCountConversationStateExtractor.ts'),
      'utf8',
    );
    expect(adult).toMatch(/isBlockedAdultCountMessage/);
    expect(child).toMatch(/isBlockedChildCountMessage/);
    expect(infant).toMatch(/isBlockedInfantCountMessage/);
    for (const source of [adult, child, infant]) {
      expect(source).toMatch(/\\bactually\\b/);
      expect(source).toMatch(/\\bnot\\b/);
      expect(source).toMatch(/\\bremove\\b/);
      expect(source).toMatch(/fromDigits < 1/);
    }
    // Adult uniquely blocks sibling passenger nouns in the same message.
    expect(adult).toMatch(/child\|children\|kids\?\|infant/);
  });

  it('adultCount: meant / make that / change that work; Actually / Not / change-count-to fail', () => {
    for (const message of [
      'Sorry, I meant 3 adults',
      'I meant 3 adults',
      'No, make that 3 adults',
      'Change that to 3 adults',
      '3 adults',
    ] as const) {
      expect(trace(message).adultExtractor, message).toEqual({
        adultCount: 3,
      });
    }

    const three = trace('I meant 3 adults');
    expect(three.extractedPatch).toEqual({ adultCount: 3 });
    expect(three.finalAdultCount).toBe(3);
    expect(three.finalChildCount).toBe(1);
    expect(three.finalInfantCount).toBe(1);
    expect(three.updated).toEqual(['adultCount']);
    expect(three.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'adultCount',
    });
    expect(three.exactFinalReply).toBe(
      "Updated to 3 adults. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );

    const singular = trace('Sorry, I meant 1 adult');
    expect(singular.extractedPatch).toEqual({ adultCount: 1 });
    expect(singular.exactFinalReply).toContain('Updated to 1 adult.');
    expect(trace('I meant one adult').extractedPatch).toEqual({
      adultCount: 1,
    });

    const failed = [
      'Actually, 3 adults',
      'Not 2 adults, 3 adults',
      'Change the adult count to 3',
    ] as const;
    for (const message of failed) {
      const t = trace(message);
      expect(t.extractedPatch, message).toEqual({});
      expect(t.finalAdultCount, message).toBe(2);
      expect(t.acknowledgementEvent, message).toBeNull();
      expect(t.exactFinalReply, message).toBe(NEUTRAL);
    }
  });

  it('childCount: meant / make that / change that work; Actually / Not / change-count-to fail', () => {
    const working = trace('I meant 2 children');
    expect(working.childExtractor).toEqual({ childCount: 2 });
    expect(working.extractedPatch).toEqual({ childCount: 2 });
    expect(working.finalChildCount).toBe(2);
    expect(working.finalAdultCount).toBe(2);
    expect(working.updated).toEqual(['childCount']);
    expect(working.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'childCount',
    });
    expect(working.exactFinalReply).toContain('Updated to 2 children.');

    expect(trace('No, make that 2 children').extractedPatch).toEqual({
      childCount: 2,
    });
    expect(trace('Change that to 2 children').extractedPatch).toEqual({
      childCount: 2,
    });

    for (const message of [
      'Actually, 2 children',
      'Not 1 child, 2 children',
      'Change the child count to 2',
    ] as const) {
      expect(trace(message).extractedPatch, message).toEqual({});
      expect(trace(message).exactFinalReply, message).toBe(NEUTRAL);
    }
  });

  it('infantCount: meant / make that / change that work for value changes; Actually / Not fail', () => {
    const change = trace('I meant 2 infants');
    expect(change.infantExtractor).toEqual({ infantCount: 2 });
    expect(change.extractedPatch).toEqual({ infantCount: 2 });
    expect(change.finalInfantCount).toBe(2);
    expect(change.updated).toEqual(['infantCount']);
    expect(change.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'infantCount',
    });
    expect(change.exactFinalReply).toContain('Updated to 2 infants.');

    // Equal-value repair: extractor emits same count; classification sees no change.
    const same = trace('I meant 1 infant');
    expect(same.infantExtractor).toEqual({ infantCount: 1 });
    expect(same.extractedPatch).toEqual({ infantCount: 1 });
    expect(same.updated).toEqual([]);
    expect(same.acknowledgementEvent).toBeNull();
    expect(same.exactFinalReply).toBe(NEUTRAL);

    for (const message of [
      'Actually, 1 infant',
      'Not 1 infant, 2 infants',
      'Change the infant count to 1',
    ] as const) {
      expect(trace(message).extractedPatch, message).toEqual({});
    }
  });

  it('null-to-value passenger repairs emit field-set acknowledgements', () => {
    const adult = trace('I meant 3 adults', {
      adultCount: null,
      childCount: null,
      infantCount: null,
    });
    expect(adult.extractedPatch).toEqual({ adultCount: 3 });
    expect(adult.newlyPopulated).toEqual(['adultCount']);
    expect(adult.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'adultCount',
    });
    expect(adult.exactFinalReply).toContain('Travelling with 3 adults.');

    const child = trace('I meant 2 children', {
      adultCount: null,
      childCount: null,
      infantCount: null,
    });
    expect(child.newlyPopulated).toEqual(['childCount']);
    expect(child.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'childCount',
    });
    expect(child.exactFinalReply).toContain("I've noted 2 children.");

    const infant = trace('I meant 1 infant', {
      adultCount: null,
      childCount: null,
      infantCount: null,
    });
    expect(infant.newlyPopulated).toEqual(['infantCount']);
    expect(infant.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'infantCount',
    });
    expect(infant.exactFinalReply).toContain('That includes 1 infant.');
  });

  it('characterizes destination collision on meant + singular child', () => {
    // Phase 17B destination "meant" cue captures "1 child" as a destination.
    const t = trace('I meant 1 child');
    expect(t.childExtractor).toEqual({ childCount: 1 });
    expect(t.extractedPatch).toEqual({
      destination: '1 child',
      childCount: 1,
    });
    expect(t.finalChildCount).toBe(1);
    // Equal childCount ⇒ only destination change is classified.
    expect(t.updated).toEqual(['destination']);
    expect(t.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(t.exactFinalReply).toContain('Updated — 1 child it is.');
  });

  it('cross-field passenger sentences produce empty or blocked patches', () => {
    for (const message of [
      'Sorry, I meant 3 adults, not 2 children',
      'Actually, 2 adults and 1 child',
      'No infants, make that 1 infant',
      'Change that to 2 children, not adults',
    ] as const) {
      const t = trace(message);
      expect(t.adultExtractor, message).toEqual({});
      expect(t.extractedPatch, message).toEqual({});
      expect(t.finalAdultCount, message).toBe(2);
      expect(t.finalChildCount, message).toBe(1);
      expect(t.finalInfantCount, message).toBe(1);
      expect(t.exactFinalReply, message).toBe(NEUTRAL);
    }
  });

  it('zero and removal phrasing produce no passenger patch', () => {
    const removals = [
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
    ] as const;
    for (const message of removals) {
      const t = trace(message);
      expect(t.extractedPatch.adultCount, message).toBeUndefined();
      expect(t.extractedPatch.childCount, message).toBeUndefined();
      expect(t.extractedPatch.infantCount, message).toBeUndefined();
      expect(t.finalAdultCount, message).toBe(2);
      expect(t.finalChildCount, message).toBe(1);
      expect(t.finalInfantCount, message).toBe(1);
      expect(t.updated, message).toEqual([]);
    }
  });

  it('characterizes negative and ambiguous unintended extractions', () => {
    const hotel = trace('The hotel allows 3 adults');
    expect(hotel.adultExtractor).toEqual({ adultCount: 3 });
    expect(hotel.extractedPatch.adultCount).toBe(3);
    expect(hotel.extractedPatch.accommodationRequested).toBe(true);

    const tickets = trace('Tickets for 2 children');
    expect(tickets.extractedPatch).toEqual({ childCount: 2 });
    expect(tickets.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'childCount',
    });

    const roomFits = trace('I meant the room fits 3 adults');
    expect(roomFits.extractedPatch).toEqual({ adultCount: 3 });

    const room3 = trace('Change that to room 3');
    expect(room3.extractedPatch).toEqual({ destination: 'room 3' });
    expect(room3.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });

    expect(trace('Actually, the flight price is for 2 adults').extractedPatch).toEqual(
      {},
    );
    expect(trace('Not sure whether 2 children are coming').extractedPatch).toEqual(
      {},
    );
    expect(trace('Infant seat required').extractedPatch).toEqual({});

    const adultOnly = trace('Adult-only hotel');
    expect(adultOnly.adultExtractor).toEqual({});
    expect(adultOnly.extractedPatch.accommodationRequested).toBe(true);

    const childFriendly = trace('Child-friendly activities');
    expect(childFriendly.childExtractor).toEqual({});
    expect(childFriendly.extractedPatch.activitiesRequested).toBe(true);
  });

  it('classification has no removed array; passenger clears are not produced by these phrases', () => {
    const classificationSource = readFileSync(
      resolve(CORE_SRC, 'classifyConversationStateChange.ts'),
      'utf8',
    );
    expect(classificationSource).not.toMatch(
      /removed:\s*readonly TravelCompareKey/,
    );
    expect(trace('No adults').updated).toEqual([]);
  });

  it('documents Phase 17F audit artifact', () => {
    const audit = readFileSync(
      resolve(ROOT, 'docs/conversation-engine/phase17-passenger-repair-audit.md'),
      'utf8',
    );
    expect(audit).toMatch(/# Phase 17 Passenger Repair Audit/);
    expect(audit).toMatch(/## Recommended Boundary for Phase 17G/);
    expect(audit).toMatch(/\\bactually\\b/);
    expect(audit).toMatch(/extraction/);
  });
});
