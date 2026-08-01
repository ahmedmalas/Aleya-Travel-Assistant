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
 * Phase 19F — child passenger progression after adult count.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ADULT_Q = FOLLOW_UPS.flightsAdultCount;
const GUEST_Q = FOLLOW_UPS.accommodationGuestCount;
const CHILD_Q = FOLLOW_UPS.childCount;
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
      conversationId: 'conversation-19f',
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
    userEntryId: 'user-19f',
    assistantEntryId: 'assistant-19f',
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

describe('Phase 19F — child passenger progression', () => {
  it('locks catalogue wording and selector predicate ownership', () => {
    expect(CHILD_Q).toBe('How many children will be travelling?');
    expect(readSrc('src/features/conversation-core/conversationReplyCatalogue.ts')).toContain(
      "childCount: 'How many children will be travelling?'",
    );

    const selector = readSrc(
      'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
    );
    expect(selector).toContain('needsChildCountFollowUp');
    expect(selector).toContain('followUps.childCount');
    expect(selector).toMatch(/flightsRequested === true \|\| state\.accommodationRequested === true/);
    expect(selector).toMatch(/adultCount !== null/);
    expect(selector).toMatch(/childCount === null/);
    // Wording stays in the catalogue, not the selector.
    expect(selector).not.toContain('How many children will be travelling?');
  });

  it('flights before adult count → adult question, not child', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
      childCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(ADULT_Q);

    const t = turn('hello there', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
    expect(t.reply).toContain(ADULT_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('accommodation before adult count → guest question, not child', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
      childCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(GUEST_Q);

    const t = turn('hello there', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(GUEST_Q);
    expect(t.reply).toContain(GUEST_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('flights after adult count → child-count question', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      childCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(CHILD_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      childCount: null,
    });
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('accommodation after adult count → child-count question', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      accommodationRequested: true,
      childCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(CHILD_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      accommodationRequested: true,
      childCount: null,
    });
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('flights + accommodation after adult count → one child-count question', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      accommodationRequested: true,
      childCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(CHILD_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      accommodationRequested: true,
      childCount: null,
    });
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).toContain(CHILD_Q);
    expect(t.reply).not.toContain(ADULT_Q);
    expect(t.reply).not.toContain(GUEST_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('does not solicit childCount without flights or accommodation', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: null,
        }),
      ),
    ).toBe(NEUTRAL);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: null,
          carHireRequested: true,
        }),
      ),
    ).toBe(NEUTRAL);
  });

  it('explicit "2 children" persists, acknowledges, and suppresses child Q', () => {
    const t = turn('2 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      childCount: null,
    });
    expect(t.extracted).toEqual({ childCount: 2 });
    expect(t.state.childCount).toBe(2);
    expect(t.classification.newlyPopulated).toContain('childCount');
    expect(t.components.acknowledgement).toMatch(/child/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('repeated unchanged child count → no false acknowledgement and no re-request', () => {
    const t = turn('2 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      childCount: 2,
    });
    expect(t.extracted).toEqual({ childCount: 2 });
    expect(t.classification.newlyPopulated).not.toContain('childCount');
    expect(t.classification.updated).not.toContain('childCount');
    expect(t.components.acknowledgement ?? '').not.toMatch(/child/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('changed child count → update acknowledgement and no re-request', () => {
    const t = turn('3 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      childCount: 2,
    });
    expect(t.state.childCount).toBe(3);
    expect(t.classification.updated).toContain('childCount');
    expect(t.components.acknowledgement).toMatch(/3 children/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('unsupported input while child count missing → child Q remains', () => {
    const t = turn('asdf qwerty', {
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      childCount: null,
    });
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('childCount captured + another required field missing → next genuine field', () => {
    const t = turn('2 children', {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      adultCount: 2,
      flightsRequested: true,
      childCount: null,
    });
    expect(t.state.childCount).toBe(2);
    expect(t.components.acknowledgement).toMatch(/child/i);
    expect(t.components.followUpQuestion).toBe(RETURN_Q);
    expect(t.reply).toContain(RETURN_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('childCount captured + otherwise complete trip → terminal continuation', () => {
    const t = turn('1 child', {
      ...COMPLETE_CORE,
      adultCount: 2,
      accommodationRequested: true,
      childCount: null,
    });
    expect(t.state.childCount).toBe(1);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
    expect(t.reply).not.toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('zero-child boundary: "0 children" remains unsupported and re-asks child Q', () => {
    const t = turn('0 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      childCount: null,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.childCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).toContain(CHILD_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('answering adults advances to child question, not neutral', () => {
    const t = turn('2 adults', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
      childCount: null,
    });
    expect(t.state.adultCount).toBe(2);
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).toContain(CHILD_Q);
    expect(t.reply).not.toContain(ADULT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('infant count remains unsolicited after child capture', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(NEUTRAL);
    expect(selectConversationFollowUpQuestion(state)).not.toMatch(/infant/i);
  });
});
