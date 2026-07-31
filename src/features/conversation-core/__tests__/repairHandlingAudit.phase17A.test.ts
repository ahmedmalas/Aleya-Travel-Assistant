import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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
 * Phase 17A — repair-handling characterization audit.
 * Documents current (including defective) behaviour only.
 * Production code is unchanged.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const EXTRACTOR = createConversationStateExtractor();
const NEUTRAL = ACTIVATED_NEUTRAL_CONTINUATION_REPLY;

type TravelSlice = {
  destination: string | null;
  origin: string | null;
  departureDate: string | null;
  returnDate: string | null;
  adultCount: number | null;
  childCount: number | null;
  infantCount: number | null;
};

type RepairTrace = {
  message: string;
  extractedPatch: ConversationStateUpdate;
  final: TravelSlice;
  updated: readonly string[];
  newlyPopulated: readonly string[];
  hasInterpretedChange: boolean;
  selectedAcknowledgement: string | null;
  acknowledgementEvent: unknown;
  selectedFollowUp: string | null;
  assembledAcknowledgements: readonly string[];
  exactFinalReply: string;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-17a',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

const POPULATED: TravelSlice = {
  destination: 'Melbourne',
  origin: 'Sydney',
  departureDate: '2026-08-10',
  returnDate: '2026-08-17',
  adultCount: 2,
  childCount: 1,
  infantCount: 1,
};

function slice(state: ConversationCoreState): TravelSlice {
  return {
    destination: state.destination,
    origin: state.origin,
    departureDate: state.departureDate,
    returnDate: state.returnDate,
    adultCount: state.adultCount,
    childCount: state.childCount,
    infantCount: state.infantCount,
  };
}

function traceRepair(
  message: string,
  seed: Partial<ConversationCoreState> = POPULATED,
): RepairTrace {
  const previous = createState(seed);
  const extraction = EXTRACTOR.extract({
    message,
    currentState: previous,
  });
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-17a',
    assistantEntryId: 'assistant-17a',
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
    extractedPatch: extraction.stateUpdate,
    final: slice(result.state),
    updated: classification.updated,
    newlyPopulated: classification.newlyPopulated,
    hasInterpretedChange: classification.hasInterpretedChange,
    selectedAcknowledgement:
      plan.acknowledgements.length === 1 ? plan.acknowledgements[0]! : null,
    acknowledgementEvent: plan.acknowledgementEvent,
    selectedFollowUp: plan.followUpQuestion,
    assembledAcknowledgements: plan.acknowledgements,
    exactFinalReply: result.reply,
  };
}

function expectUnchangedPopulated(trace: RepairTrace): void {
  expect(trace.extractedPatch).toEqual({});
  expect(trace.final).toEqual(POPULATED);
  expect(trace.updated).toEqual([]);
  expect(trace.newlyPopulated).toEqual([]);
  expect(trace.hasInterpretedChange).toBe(false);
  expect(trace.selectedAcknowledgement).toBeNull();
  expect(trace.acknowledgementEvent).toBeNull();
  expect(trace.assembledAcknowledgements).toEqual([]);
  expect(trace.exactFinalReply).toBe(NEUTRAL);
}

describe('Phase 17A — repair handling characterization audit', () => {
  it('primary case: Sorry, I meant Cairns leaves Melbourne unchanged', () => {
    const trace = traceRepair('Sorry, I meant Cairns');
    expectUnchangedPopulated(trace);
    expect(trace.final.destination).toBe('Melbourne');
    expect(trace.selectedFollowUp).toBe(
      'What else should I know about your trip?',
    );
  });

  it('characterizes required destination repair phrases against populated Melbourne', () => {
    const failedPhrases = [
      'Sorry, I meant Cairns',
      'I meant Cairns',
      'Actually, Cairns',
      'No, make that Cairns',
      'Change that to Cairns',
      'Not Melbourne, Cairns',
    ] as const;

    for (const phrase of failedPhrases) {
      const trace = traceRepair(phrase);
      expect(trace.extractedPatch, phrase).toEqual({});
      expect(trace.final.destination, phrase).toBe('Melbourne');
      expect(trace.hasInterpretedChange, phrase).toBe(false);
      expect(trace.selectedAcknowledgement, phrase).toBeNull();
      expect(trace.acknowledgementEvent, phrase).toBeNull();
      expect(trace.exactFinalReply, phrase).toBe(NEUTRAL);
    }

    // Contrast: cue-backed destination replacements succeed today.
    const changeIt = traceRepair('change it to Cairns');
    expect(changeIt.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(changeIt.final.destination).toBe('Cairns');
    expect(changeIt.updated).toEqual(['destination']);
    expect(changeIt.selectedAcknowledgement).toBe('Great — Cairns.');
    expect(changeIt.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(changeIt.exactFinalReply).toBe(
      "Updated — Cairns it is. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );

    const goTo = traceRepair('go to Cairns');
    expect(goTo.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(goTo.final.destination).toBe('Cairns');

    const actuallyMakeIt = traceRepair('Actually make it Cairns');
    expect(actuallyMakeIt.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(actuallyMakeIt.final.destination).toBe('Cairns');
  });

  it('field-by-field: destination repair fails when populated or null', () => {
    const populated = traceRepair('Sorry, I meant Cairns', POPULATED);
    expectUnchangedPopulated(populated);

    const whenNull = traceRepair('Sorry, I meant Cairns', {
      destination: null,
      origin: 'Sydney',
    });
    expect(whenNull.extractedPatch).toEqual({});
    expect(whenNull.final.destination).toBeNull();
    expect(whenNull.hasInterpretedChange).toBe(false);
    expect(whenNull.exactFinalReply).toBe(NEUTRAL);

    // Old and new values both in sentence — blocked by \\bnot\\b.
    const bothValues = traceRepair('Not Melbourne, Cairns');
    expect(bothValues.extractedPatch).toEqual({});
    expect(bothValues.final.destination).toBe('Melbourne');
  });

  it('field-by-field: origin repair phrases vs cue-backed replacement', () => {
    expectUnchangedPopulated(traceRepair('I meant Sydney'));
    expectUnchangedPopulated(traceRepair('Actually, Sydney'));

    const nullOrigin = traceRepair('Sorry, I meant Brisbane', {
      ...POPULATED,
      origin: null,
    });
    expect(nullOrigin.extractedPatch).toEqual({});
    expect(nullOrigin.final.origin).toBeNull();
    expect(nullOrigin.hasInterpretedChange).toBe(false);

    // Cue-backed origin change still works.
    const cue = traceRepair('from Brisbane instead');
    expect(cue.extractedPatch).toEqual({ origin: 'Brisbane' });
    expect(cue.final.origin).toBe('Brisbane');
    expect(cue.updated).toEqual(['origin']);
    expect(cue.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
  });

  it('field-by-field: departureDate — actually/meant bare dates fail; explicit Depart on works', () => {
    expectUnchangedPopulated(traceRepair('Sorry, I meant 30 August 2026'));
    // \\bactually\\b hard-blocks departure date extraction.
    expectUnchangedPopulated(
      traceRepair('Actually, Depart on 30 August 2026'),
    );

    const nullDeparture = traceRepair('Sorry, I meant 30 August 2026', {
      ...POPULATED,
      departureDate: null,
    });
    expect(nullDeparture.extractedPatch).toEqual({});
    expect(nullDeparture.final.departureDate).toBeNull();

    const cue = traceRepair('Depart on 30 August 2026');
    expect(cue.extractedPatch).toEqual({ departureDate: '2026-08-30' });
    expect(cue.final.departureDate).toBe('2026-08-30');
    expect(cue.updated).toEqual(['departureDate']);
    expect(cue.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'departureDate',
    });
  });

  it('field-by-field: returnDate — meant+Return on works; Actually blocks', () => {
    // Return cue survives a leading "Sorry, I meant" preface.
    const meantReturn = traceRepair(
      'Sorry, I meant Return on 20 August 2026',
    );
    expect(meantReturn.extractedPatch).toEqual({
      returnDate: '2026-08-20',
    });
    expect(meantReturn.final.returnDate).toBe('2026-08-20');
    expect(meantReturn.updated).toEqual(['returnDate']);
    expect(meantReturn.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'returnDate',
    });

    // \\bactually\\b hard-blocks return date extraction.
    expectUnchangedPopulated(
      traceRepair('Actually, Return on 20 August 2026'),
    );

    const cue = traceRepair('Return on 20 August 2026');
    expect(cue.extractedPatch).toEqual({ returnDate: '2026-08-20' });
    expect(cue.final.returnDate).toBe('2026-08-20');
  });

  it('field-by-field: adultCount — meant/count cues succeed; actually/not block', () => {
    const meant = traceRepair('Sorry, I meant 3 adults');
    expect(meant.extractedPatch).toEqual({ adultCount: 3 });
    expect(meant.final.adultCount).toBe(3);
    expect(meant.updated).toEqual(['adultCount']);
    expect(meant.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'adultCount',
    });
    expect(meant.exactFinalReply).toBe(
      "Updated to 3 adults. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );

    // Change that to … still matches \\b3 adults\\b.
    const changeThat = traceRepair('Change that to 3 adults');
    expect(changeThat.extractedPatch).toEqual({ adultCount: 3 });
    expect(changeThat.final.adultCount).toBe(3);

    expectUnchangedPopulated(traceRepair('Actually, 3 adults'));
    expectUnchangedPopulated(traceRepair('Not 2 adults, 3 adults'));

    const nullAdults = traceRepair('Sorry, I meant 3 adults', {
      ...POPULATED,
      adultCount: null,
    });
    expect(nullAdults.extractedPatch).toEqual({ adultCount: 3 });
    expect(nullAdults.final.adultCount).toBe(3);
    expect(nullAdults.newlyPopulated).toEqual(['adultCount']);
    expect(nullAdults.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'adultCount',
    });
  });

  it('field-by-field: childCount and infantCount extract through meant + count cue', () => {
    const child = traceRepair('I meant 2 children');
    expect(child.extractedPatch).toEqual({ childCount: 2 });
    expect(child.final.childCount).toBe(2);
    expect(child.updated).toEqual(['childCount']);
    expect(child.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'childCount',
    });

    const infant = traceRepair('I meant 2 infants');
    expect(infant.extractedPatch).toEqual({ infantCount: 2 });
    expect(infant.final.infantCount).toBe(2);
    expect(infant.updated).toEqual(['infantCount']);
    expect(infant.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'infantCount',
    });
  });

  it('multi-fact repair: destination missed; origin polluted; departure conditional on year', () => {
    const withoutYear = traceRepair(
      'Sorry, I meant Cairns, leaving from Sydney on 28 August',
    );
    expect(withoutYear.extractedPatch).toEqual({
      origin: 'Sydney on 28 August',
    });
    expect(withoutYear.final.destination).toBe('Melbourne');
    expect(withoutYear.final.origin).toBe('Sydney on 28 August');
    expect(withoutYear.final.departureDate).toBe('2026-08-10');
    expect(withoutYear.updated).toEqual(['origin']);
    expect(withoutYear.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
    expect(withoutYear.exactFinalReply).toBe(
      "We'll depart from Sydney on 28 August instead. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );

    const withYear = traceRepair(
      'Sorry, I meant Cairns, leaving from Brisbane on 28 August 2026',
    );
    expect(withYear.extractedPatch).toEqual({
      origin: 'Brisbane on 28 August 2026',
      departureDate: '2026-08-28',
    });
    expect(withYear.final.destination).toBe('Melbourne');
    expect(withYear.final.origin).toBe('Brisbane on 28 August 2026');
    expect(withYear.final.departureDate).toBe('2026-08-28');
    expect(withYear.updated).toEqual(['origin', 'departureDate']);
    // Origin acknowledgement wins priority over departureDate.
    expect(withYear.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'origin',
    });
    expect(withYear.selectedAcknowledgement).toBe(
      'Perfect — departing from Brisbane on 28 August 2026.',
    );
  });

  it('ambiguous / invalid corrected values produce empty destination patches', () => {
    expectUnchangedPopulated(traceRepair('Sorry, I meant somewhere'));
    expectUnchangedPopulated(traceRepair('I meant Cairns or Hobart'));
  });

  it('classification has no removed array; clears appear in updated when they occur', () => {
    const classificationSource = readFileSync(
      resolve(CORE_SRC, 'classifyConversationStateChange.ts'),
      'utf8',
    );
    expect(classificationSource).not.toMatch(
      /removed:\s*readonly TravelCompareKey/,
    );
    expect(classificationSource).toMatch(/updated: readonly TravelCompareKey/);

    // Repair failures do not clear fields — updated stays empty.
    const failed = traceRepair('Sorry, I meant Cairns');
    expect(failed.updated).toEqual([]);
  });

  it('proves root cause is extraction: empty patch precedes inert classification and selection', () => {
    const message = 'Sorry, I meant Cairns';
    const previous = createState(POPULATED);
    const extraction = EXTRACTOR.extract({
      message,
      currentState: previous,
    });
    expect(extraction.stateUpdate).toEqual({});

    const result = processConversationTurn({
      message,
      state: previous,
      userEntryId: 'user-17a-root',
      assistantEntryId: 'assistant-17a-root',
      userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    });
    expect(slice(result.state)).toEqual(POPULATED);

    const classification = classifyConversationStateChange(
      previous,
      result.state,
    );
    expect(classification.hasInterpretedChange).toBe(false);
    expect(classification.updated).toEqual([]);

    const plan = createConversationReplyPlan({
      state: result.state,
      classification,
    });
    expect(plan.acknowledgements).toEqual([]);
    expect(plan.acknowledgementEvent).toBeNull();
    expect(result.reply).toBe(NEUTRAL);

    // Destination extractor has no "meant" cue and blocks \\bnot\\b.
    const destinationSource = readFileSync(
      resolve(CORE_SRC, 'DestinationConversationStateExtractor.ts'),
      'utf8',
    );
    expect(destinationSource).not.toMatch(/meant/i);
    expect(destinationSource).toMatch(/\\bnot\\b/);
    expect(destinationSource).toMatch(/change\\s\+it\\s\+to/);
  });

  it('documents Phase 17A audit artifact and production modules untouched', () => {
    const audit = readFileSync(
      resolve(
        ROOT,
        'docs/conversation-engine/phase17-repair-handling-audit.md',
      ),
      'utf8',
    );
    expect(audit).toMatch(/# Phase 17 Repair Handling Audit/);
    expect(audit).toMatch(/## Defect Ownership/);
    expect(audit).toMatch(/## Recommended Boundary for Phase 17B/);
    expect(audit).toMatch(/extraction/);
    expect(audit).toMatch(/Sorry, I meant Cairns/);

    // Transform / event contract signatures from Phase 16J remain unchanged.
    const transform = readFileSync(
      resolve(CORE_SRC, 'transformBaselineAcknowledgement.ts'),
      'utf8',
    );
    expect(transform).toMatch(/Phase 16J/);
  });
});
