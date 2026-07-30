import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';
import { selectConversationMessageInterpreted } from '../selectConversationMessageInterpreted';

/**
 * Phase 11I — non-capability clear-transition characterisation.
 *
 * Locks current classification, acknowledgement, and interpretation behaviour
 * for supported non-capability fields clearing stored value → null, before any
 * removal-specific wording is introduced. Does not change production behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-11i-clear-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

const NON_CAPABILITY_CLEARS = [
  { field: 'destination', stored: 'Cairns' },
  { field: 'origin', stored: 'Sydney' },
  { field: 'departureDate', stored: '2026-08-28' },
  { field: 'returnDate', stored: '2026-09-05' },
  { field: 'adultCount', stored: 2 },
  { field: 'childCount', stored: 1 },
  { field: 'infantCount', stored: 1 },
] as const;

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
  state: ConversationCoreState,
  index: number,
  stateUpdate?: ConversationStateUpdate,
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-11i-${index}`,
    assistantEntryId: `assistant-11i-${index}`,
    userMessageAt: new Date(CREATED_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(CREATED_AT.getTime() + index * 2000 + 1000),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
  });
}

function characterizeClear(
  field: (typeof NON_CAPABILITY_CLEARS)[number]['field'],
  stored: (typeof NON_CAPABILITY_CLEARS)[number]['stored'],
) {
  const previous = createState({ [field]: stored });
  const next = createState({ [field]: null });
  const classification = classifyConversationStateChange(previous, next);
  const acknowledgement = selectConversationAcknowledgement(
    next,
    classification,
  );
  const messageInterpreted = selectConversationMessageInterpreted(classification);

  return {
    previous,
    next,
    classification,
    acknowledgement,
    messageInterpreted,
  };
}

describe('phase 11I — non-capability clear-transition audit characterisation', () => {
  it.each(NON_CAPABILITY_CLEARS)(
    '$field: stored value → null is updated, interpreted, and acknowledgement-eligible',
    ({ field, stored }) => {
      const {
        classification,
        acknowledgement,
        messageInterpreted,
      } = characterizeClear(field, stored);

      expect(classification.updated).toContain(field);
      expect(classification.newlyPopulated).not.toContain(field);
      expect(classification.newlyEnabledRequestFlags).not.toContain(field);
      expect(classification.newlyDisabledRequestFlags).not.toContain(field);
      expect(classification.hasInterpretedChange).toBe(true);
      expect(classification.hasAcknowledgementEligibleChange).toBe(true);
      expect(messageInterpreted).toBe(true);
      // Phase 11J — destination clear uses dedicated removal wording.
      expect(acknowledgement).toBe(
        field === 'destination' ? 'Destination removed.' : 'Perfect.',
      );
    },
  );

  it('each non-capability clear reaches its acknowledgement through processConversationTurn', () => {
    for (const [index, { field }] of NON_CAPABILITY_CLEARS.entries()) {
      const previous = createState();
      const result = turn('hello', previous, index, {
        [field]: null,
      } as ConversationStateUpdate);

      expect(result.state[field]).toBeNull();
      if (field === 'destination') {
        expect(result.reply).toContain('Destination removed.');
        expect(result.reply).not.toMatch(/Perfect\./);
      } else {
        expect(result.reply).toMatch(/Perfect\./);
        expect(result.reply.match(/Perfect\./g)?.length).toBe(1);
      }
    }
  });

  it('multiple non-capability clears yield one acknowledgement only (destination removal wins)', () => {
    const previous = createState();
    const next = createState({
      destination: null,
      origin: null,
      departureDate: null,
      returnDate: null,
      adultCount: null,
      childCount: null,
      infantCount: null,
    });
    const classification = classifyConversationStateChange(previous, next);

    expect(classification.updated).toEqual(
      expect.arrayContaining([
        'destination',
        'origin',
        'departureDate',
        'returnDate',
        'adultCount',
        'childCount',
        'infantCount',
      ]),
    );
    expect(classification.hasInterpretedChange).toBe(true);
    expect(classification.hasAcknowledgementEligibleChange).toBe(true);
    expect(selectConversationMessageInterpreted(classification)).toBe(true);
    expect(selectConversationAcknowledgement(next, classification)).toBe(
      'Destination removed.',
    );

    const result = turn('hello', previous, 0, {
      destination: null,
      origin: null,
      departureDate: null,
      returnDate: null,
      adultCount: null,
      childCount: null,
      infantCount: null,
    });
    expect(result.reply).toContain('Destination removed.');
    expect(result.reply.match(/Destination removed\./g)?.length).toBe(1);
    expect(result.reply).not.toMatch(/Perfect\./);
    expect(result.reply).not.toMatch(/I've added /);
    expect(result.reply).not.toMatch(/I've removed /);
    expect(result.reply).not.toMatch(/I've noted /);
  });

  it('non-capability clear + newly enabled capability → enabled capability acknowledgement wins', () => {
    const previous = createState({ flightsRequested: null });
    const next = createState({
      destination: null,
      flightsRequested: true,
    });
    const classification = classifyConversationStateChange(previous, next);

    expect(classification.updated).toContain('destination');
    expect(classification.newlyEnabledRequestFlags).toEqual([
      'flightsRequested',
    ]);
    expect(selectConversationAcknowledgement(next, classification)).toBe(
      "I've added flights to your trip requirements.",
    );
    expect(selectConversationAcknowledgement(next, classification)).not.toBe(
      'Perfect.',
    );

    const result = turn('hello', previous, 0, {
      destination: null,
      flightsRequested: true,
    });
    expect(result.reply).toContain(
      "I've added flights to your trip requirements.",
    );
    expect(result.reply).not.toMatch(/Perfect\./);
  });

  it('non-capability clear + newly disabled capability → removed capability acknowledgement wins', () => {
    const previous = createState({ flightsRequested: true });
    const next = createState({
      origin: null,
      flightsRequested: false,
    });
    const classification = classifyConversationStateChange(previous, next);

    expect(classification.updated).toContain('origin');
    expect(classification.newlyDisabledRequestFlags).toEqual([
      'flightsRequested',
    ]);
    expect(selectConversationAcknowledgement(next, classification)).toBe(
      "I've removed flights from your trip requirements.",
    );
    expect(selectConversationAcknowledgement(next, classification)).not.toBe(
      'Perfect.',
    );

    const result = turn('hello', previous, 0, {
      origin: null,
      flightsRequested: false,
    });
    expect(result.reply).toContain(
      "I've removed flights from your trip requirements.",
    );
    expect(result.reply).not.toMatch(/Perfect\./);
  });

  it('non-capability clear + destination set to a new value → destination acknowledgement wins', () => {
    const previous = createState({
      destination: 'Cairns',
      adultCount: 2,
    });
    const next = createState({
      destination: 'Hobart',
      adultCount: null,
    });
    const classification = classifyConversationStateChange(previous, next);

    expect(classification.updated).toEqual(
      expect.arrayContaining(['destination', 'adultCount']),
    );
    expect(selectConversationAcknowledgement(next, classification)).toBe(
      'Great — Hobart.',
    );
    expect(selectConversationAcknowledgement(next, classification)).not.toBe(
      'Perfect.',
    );

    const result = turn('hello', previous, 0, {
      destination: 'Hobart',
      adultCount: null,
    });
    expect(result.reply).toContain('Great — Hobart.');
    expect(result.reply).not.toMatch(/Perfect\./);
  });

  it('request flag true → null remains interpreted but not acknowledgement eligible', () => {
    const previous = createState({ flightsRequested: true });
    const next = createState({ flightsRequested: null });
    const classification = classifyConversationStateChange(previous, next);

    expect(classification.updated).toContain('flightsRequested');
    expect(classification.newlyDisabledRequestFlags).toEqual([]);
    expect(classification.hasInterpretedChange).toBe(true);
    expect(classification.hasAcknowledgementEligibleChange).toBe(false);
    expect(selectConversationMessageInterpreted(classification)).toBe(true);
    expect(selectConversationAcknowledgement(next, classification)).toBeNull();

    const result = turn('hello', previous, 0, { flightsRequested: null });
    expect(result.state.flightsRequested).toBeNull();
    expect(result.reply).not.toMatch(/Perfect\./);
    expect(result.reply).not.toMatch(/I've removed flights/);
  });

  it('request flag false → null remains interpreted but not acknowledgement eligible', () => {
    const previous = createState({ flightsRequested: false });
    const next = createState({ flightsRequested: null });
    const classification = classifyConversationStateChange(previous, next);

    expect(classification.updated).toContain('flightsRequested');
    expect(classification.newlyDisabledRequestFlags).toEqual([]);
    expect(classification.hasInterpretedChange).toBe(true);
    expect(classification.hasAcknowledgementEligibleChange).toBe(false);
    expect(selectConversationMessageInterpreted(classification)).toBe(true);
    expect(selectConversationAcknowledgement(next, classification)).toBeNull();

    const result = turn('hello', previous, 0, { flightsRequested: null });
    expect(result.state.flightsRequested).toBeNull();
    expect(result.reply).not.toMatch(/Perfect\./);
    expect(result.reply).not.toMatch(/I've removed flights/);
  });
});
