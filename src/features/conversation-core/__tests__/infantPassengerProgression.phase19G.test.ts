import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 19G — infant passenger progression after adult and child counts.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const ADULT_Q = FOLLOW_UPS.flightsAdultCount;
const GUEST_Q = FOLLOW_UPS.accommodationGuestCount;
const CHILD_Q = FOLLOW_UPS.childCount;
const INFANT_Q = FOLLOW_UPS.infantCount;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const RETURN_Q = FOLLOW_UPS.returnDate;
const SELECTABLE_QUESTIONS = Object.values(FOLLOW_UPS);

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
} as const;

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-19g',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(message: string, seed: Partial<ConversationCoreState> = {}) {
  const previous = createState(seed);
  const extracted = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-19g',
    assistantEntryId: 'assistant-19g',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
  });
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const components = selectConversationReplyComponents({
    state: result.state,
    classification,
  });
  return {
    previous,
    extracted,
    classification,
    components,
    state: result.state,
    reply: result.reply,
  };
}

function assertSingleSelectedQuestion(reply: string): void {
  expect(
    SELECTABLE_QUESTIONS.filter((question) => reply.includes(question)).length,
  ).toBeLessThanOrEqual(1);
}

describe('Phase 19G — infant passenger progression', () => {
  it('locks catalogue wording and selector predicate ownership', () => {
    expect(INFANT_Q).toBe('How many infants will be travelling?');
    expect(
      readSrc('src/features/conversation-core/conversationReplyCatalogue.ts'),
    ).toContain("infantCount: 'How many infants will be travelling?'");

    const selector = readSrc(
      'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
    );
    expect(selector).toContain('needsInfantCountFollowUp');
    expect(selector).toContain('followUps.infantCount');
    expect(selector).toMatch(
      /flightsRequested === true \|\| state\.accommodationRequested === true/,
    );
    expect(selector).toMatch(/adultCount !== null/);
    expect(selector).toMatch(/childCount !== null/);
    expect(selector).toMatch(/infantCount === null/);
    expect(selector).not.toContain('How many infants will be travelling?');
  });

  it('flights before adult count → adult question, not child or infant', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(ADULT_Q);

    const t = turn('hello there', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('accommodation before adult count → guest question, not child or infant', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(GUEST_Q);

    const t = turn('hello there', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(GUEST_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('child-before-infant priority after adults', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(CHILD_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('flights after adult and child counts → infant-count question', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(INFANT_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    expect(t.reply).toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('accommodation after adult and child counts → infant-count question', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 1,
      infantCount: null,
      accommodationRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(INFANT_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 1,
      infantCount: null,
      accommodationRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    expect(t.reply).toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('flights + accommodation after adult and child → one infant-count question', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
      accommodationRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(INFANT_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
      accommodationRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    expect(t.reply).toContain(INFANT_Q);
    expect(t.reply).not.toContain(ADULT_Q);
    expect(t.reply).not.toContain(GUEST_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('does not solicit infantCount without flights or accommodation', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: 2,
          infantCount: null,
        }),
      ),
    ).toBe(NEUTRAL);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: 2,
          infantCount: null,
          carHireRequested: true,
        }),
      ),
    ).toBe(NEUTRAL);
  });

  it('explicit "1 infant" persists with singular acknowledgement and suppresses infant Q', () => {
    const t = turn('1 infant', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({ infantCount: 1 });
    expect(t.state.infantCount).toBe(1);
    expect(t.classification.newlyPopulated).toContain('infantCount');
    expect(t.components.acknowledgement).toMatch(/1 infant/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('explicit "2 infants" persists with plural acknowledgement and suppresses infant Q', () => {
    const t = turn('2 infants', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      accommodationRequested: true,
    });
    expect(t.extracted).toEqual({ infantCount: 2 });
    expect(t.state.infantCount).toBe(2);
    expect(t.components.acknowledgement).toMatch(/2 infants/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('repeated unchanged infant count → no false acknowledgement and no re-request', () => {
    const t = turn('1 infant', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({ infantCount: 1 });
    expect(t.classification.newlyPopulated).not.toContain('infantCount');
    expect(t.classification.updated).not.toContain('infantCount');
    expect(t.components.acknowledgement ?? '').not.toMatch(/infant/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('changed infant count → update acknowledgement and no re-request', () => {
    const t = turn('2 infants', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      flightsRequested: true,
    });
    expect(t.state.infantCount).toBe(2);
    expect(t.classification.updated).toContain('infantCount');
    expect(t.components.acknowledgement).toMatch(/2 infants/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('unsupported input while infant count missing → infant Q remains', () => {
    const t = turn('asdf qwerty', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    expect(t.reply).toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('infantCount captured + another required field missing → next genuine field', () => {
    const t = turn('1 infant', {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.state.infantCount).toBe(1);
    expect(t.components.acknowledgement).toMatch(/infant/i);
    expect(t.components.followUpQuestion).toBe(RETURN_Q);
    expect(t.reply).toContain(RETURN_Q);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('infantCount captured + otherwise complete trip → terminal continuation', () => {
    const t = turn('1 infant', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 1,
      infantCount: null,
      accommodationRequested: true,
    });
    expect(t.state.infantCount).toBe(1);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
    expect(t.reply).not.toContain(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('zero-infant support (Phase 19L): "0 infants" completes infant and continues neutrally', () => {
    const t = turn('0 infants', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({ infantCount: 0 });
    expect(t.state.infantCount).toBe(0);
    expect(t.classification.hasInterpretedChange).toBe(true);
    expect(t.components.acknowledgement).toBe(ACKS.infantCount(0));
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
    assertSingleSelectedQuestion(t.reply);
  });

  it('answering children advances to infant question, not neutral', () => {
    const t = turn('2 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.state.childCount).toBe(2);
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    expect(t.reply).toContain(INFANT_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });
});
