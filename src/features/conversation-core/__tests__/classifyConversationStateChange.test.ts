import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import {
  classifyConversationStateChange,
  fieldValueChanged,
} from '../classifyConversationStateChange';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  generateConversationReply,
} from '../generateConversationReply';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';

const ROOT = process.cwd();
const CLASSIFY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/classifyConversationStateChange.ts',
);
const REPLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-10f',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
    ...overrides,
  });
}

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-10f',
    assistantEntryId: 'assistant-10f',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10F — deterministic change classification', () => {
  it('keeps classification internal to conversation-core reply wiring', () => {
    const classifySource = readFileSync(CLASSIFY_SOURCE, 'utf8');
    const replySource = readFileSync(REPLY_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(classifySource).toContain('Phase 10F');
    expect(classifySource).toContain('Phase 11C');
    expect(classifySource).toContain('Phase 11E');
    expect(classifySource).toContain('Phase 11F');
    expect(classifySource).toContain('Phase 11G');
    expect(classifySource).toContain('Phase 11H');
    expect(classifySource).toMatch(/newlyDisabledRequestFlags/);
    expect(classifySource).toMatch(/hasInterpretedChange/);
    expect(classifySource).toMatch(/hasAcknowledgementEligibleChange/);
    expect(classifySource).not.toMatch(/\bhasAnyChange\b/);
    expect(classifySource).toMatch(/export function classifyConversationStateChange/);
    expect(replySource).toContain('Phase 10F');
    expect(replySource).toMatch(/classifyConversationStateChange\(/);
    expect(index).not.toMatch(/classifyConversationStateChange/);
    expect(processTurn).not.toMatch(/classifyConversationStateChange/);
  });

  it('classifies newly populated fields', () => {
    const classification = classifyConversationStateChange(
      createState(),
      createState({ destination: 'Brisbane', adultCount: 2 }),
    );
    expect(classification.newlyPopulated).toEqual(
      expect.arrayContaining(['destination', 'adultCount']),
    );
    expect(classification.newlyPopulated).not.toContain('origin');
    expect(fieldValueChanged(classification, 'destination')).toBe(true);
    expect(classification.hasAcknowledgementEligibleChange).toBe(true);
  });

  it('classifies updated fields', () => {
    const classification = classifyConversationStateChange(
      createState({ destination: 'Brisbane', adultCount: 2 }),
      createState({ destination: 'Cairns', adultCount: 4 }),
    );
    expect(classification.updated).toEqual(
      expect.arrayContaining(['destination', 'adultCount']),
    );
    expect(classification.newlyPopulated).not.toContain('destination');
    expect(fieldValueChanged(classification, 'destination')).toBe(true);
  });

  it('classifies unchanged fields', () => {
    const classification = classifyConversationStateChange(
      createState({ destination: 'Cairns', origin: 'Sydney' }),
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        flightsRequested: true,
      }),
    );
    expect(classification.unchanged).toEqual(
      expect.arrayContaining(['destination', 'origin']),
    );
    expect(classification.newlyEnabledRequestFlags).toContain(
      'flightsRequested',
    );
    expect(fieldValueChanged(classification, 'destination')).toBe(false);
  });

  it('classifies newly enabled boolean request flags', () => {
    const fromNull = classifyConversationStateChange(
      createState({ flightsRequested: null }),
      createState({ flightsRequested: true }),
    );
    expect(fromNull.newlyEnabledRequestFlags).toEqual(['flightsRequested']);
    expect(fromNull.newlyPopulated).not.toContain('flightsRequested');
    expect(fromNull.newlyDisabledRequestFlags).toEqual([]);

    const fromFalse = classifyConversationStateChange(
      createState({ accommodationRequested: false }),
      createState({ accommodationRequested: true }),
    );
    expect(fromFalse.newlyEnabledRequestFlags).toEqual([
      'accommodationRequested',
    ]);
    expect(fromFalse.updated).not.toContain('accommodationRequested');
    expect(fromFalse.newlyDisabledRequestFlags).toEqual([]);
  });

  it('classifies newly disabled boolean request flags for true→false and null→false', () => {
    const trueToFalse = classifyConversationStateChange(
      createState({ flightsRequested: true }),
      createState({ flightsRequested: false }),
    );
    expect(trueToFalse.newlyDisabledRequestFlags).toEqual(['flightsRequested']);
    expect(trueToFalse.updated).not.toContain('flightsRequested');
    expect(trueToFalse.newlyEnabledRequestFlags).toEqual([]);
    expect(trueToFalse.hasAcknowledgementEligibleChange).toBe(true);

    const trueToNull = classifyConversationStateChange(
      createState({ flightsRequested: true }),
      createState({ flightsRequested: null }),
    );
    expect(trueToNull.newlyDisabledRequestFlags).toEqual([]);
    expect(trueToNull.updated).toContain('flightsRequested');
    expect(trueToNull.hasAcknowledgementEligibleChange).toBe(false);
    expect(trueToNull.hasInterpretedChange).toBe(true);

    const nullToFalse = classifyConversationStateChange(
      createState({ flightsRequested: null }),
      createState({ flightsRequested: false }),
    );
    expect(nullToFalse.newlyDisabledRequestFlags).toEqual(['flightsRequested']);
    expect(nullToFalse.newlyPopulated).not.toContain('flightsRequested');
    expect(nullToFalse.updated).not.toContain('flightsRequested');

    const falseToNull = classifyConversationStateChange(
      createState({ flightsRequested: false }),
      createState({ flightsRequested: null }),
    );
    expect(falseToNull.newlyDisabledRequestFlags).toEqual([]);
    expect(falseToNull.updated).toContain('flightsRequested');
    expect(falseToNull.hasAcknowledgementEligibleChange).toBe(false);
    expect(falseToNull.hasInterpretedChange).toBe(true);

    const falseUnchanged = classifyConversationStateChange(
      createState({ flightsRequested: false }),
      createState({ flightsRequested: false }),
    );
    expect(falseUnchanged.newlyDisabledRequestFlags).toEqual([]);
    expect(falseUnchanged.unchanged).toContain('flightsRequested');
  });

  it('preserves existing acknowledgement, progression and suppression behaviour', () => {
    expect(turn('go to Brisbane', createState()).reply).toBe(
      'Great, Brisbane it is. Where will you be travelling from?',
    );

    expect(
      turn('from Sydney', createState({ destination: 'Brisbane' })).reply,
    ).toBe(
      "We'll start from Sydney. When would you like to depart?",
    );

    expect(turn('book flights', completeCore()).reply).toBe(
      "Great, I've added flights to your trip. How many adults will be travelling?",
    );

    expect(
      turn('book flights', completeCore({ adultCount: 2 })).reply,
    ).toBe(
      `Great, I've added flights to your trip. Tell me anything else that matters for this trip. ${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );

    expect(
      turn(
        'book flights. book a hotel. book activities',
        completeCore({ adultCount: 2 }),
      ).reply,
    ).toBe(
      "Great, I've added flights, accommodation and activities to your trip. What kinds of activities are you interested in?",
    );

    expect(turn('Hello there', createState({ destination: 'Cairns' })).reply).toBe(
      ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
    );

    expect(
      generateConversationReply({
        message: 'ignored',
        previousState: completeCore({ adultCount: 2 }),
        state: completeCore({
          adultCount: 2,
          beachesRequested: true,
        }),
      }),
    ).toBe(
      `Great, I've added beaches to your trip. Tell me anything else that matters for this trip. ${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );
  });
});

describe('phase 11H — acknowledgement-eligible change rename', () => {
  it('exposes hasAcknowledgementEligibleChange and omits hasAnyChange', () => {
    const classification = classifyConversationStateChange(
      createState(),
      createState({ destination: 'Brisbane' }),
    );
    expect(classification).toHaveProperty('hasAcknowledgementEligibleChange');
    expect(classification).toHaveProperty('hasInterpretedChange');
    expect(classification).not.toHaveProperty('hasAnyChange');
  });

  it('keeps interpreted and acknowledgement-eligible flags aligned for visible changes', () => {
    const destination = classifyConversationStateChange(
      createState(),
      createState({ destination: 'Brisbane' }),
    );
    expect(destination.hasInterpretedChange).toBe(true);
    expect(destination.hasAcknowledgementEligibleChange).toBe(true);

    const enabled = classifyConversationStateChange(
      createState({ flightsRequested: null }),
      createState({ flightsRequested: true }),
    );
    expect(enabled.hasInterpretedChange).toBe(true);
    expect(enabled.hasAcknowledgementEligibleChange).toBe(true);

    const removed = classifyConversationStateChange(
      createState({ flightsRequested: true }),
      createState({ flightsRequested: false }),
    );
    expect(removed.hasInterpretedChange).toBe(true);
    expect(removed.hasAcknowledgementEligibleChange).toBe(true);

    const cleared = classifyConversationStateChange(
      createState({ destination: 'Cairns' }),
      createState({ destination: null }),
    );
    expect(cleared.hasInterpretedChange).toBe(true);
    expect(cleared.hasAcknowledgementEligibleChange).toBe(true);
  });

  it('keeps request-flag clears to null interpreted but not acknowledgement-eligible alone', () => {
    const trueToNull = classifyConversationStateChange(
      createState({ flightsRequested: true }),
      createState({ flightsRequested: null }),
    );
    expect(trueToNull.hasInterpretedChange).toBe(true);
    expect(trueToNull.hasAcknowledgementEligibleChange).toBe(false);

    const falseToNull = classifyConversationStateChange(
      createState({ flightsRequested: false }),
      createState({ flightsRequested: null }),
    );
    expect(falseToNull.hasInterpretedChange).toBe(true);
    expect(falseToNull.hasAcknowledgementEligibleChange).toBe(false);
  });
});
