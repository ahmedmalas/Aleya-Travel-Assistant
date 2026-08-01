import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BareNumberPassengerCountConversationStateExtractor } from '../BareNumberPassengerCountConversationStateExtractor';
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
 * Phase 19I — bare-number answers for the active passenger-count follow-up.
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
      conversationId: 'conversation-19i',
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
    userEntryId: 'user-19i',
    assistantEntryId: 'assistant-19i',
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

describe('Phase 19I — bare-number passenger extraction', () => {
  it('locks contextual extractor ownership outside Adult/Child/Infant extractors', () => {
    const factory = readSrc(
      'src/features/conversation-core/createConversationStateExtractor.ts',
    );
    expect(factory).toContain('BareNumberPassengerCountConversationStateExtractor');

    const bare = readSrc(
      'src/features/conversation-core/BareNumberPassengerCountConversationStateExtractor.ts',
    );
    expect(bare).toContain('Phase 19I');
    expect(bare).toContain('input.currentState');
    expect(bare).not.toContain('selectConversationFollowUpQuestion');

    expect(
      readSrc(
        'src/features/conversation-core/AdultCountConversationStateExtractor.ts',
      ),
    ).not.toContain('input.currentState');
    expect(
      readSrc(
        'src/features/conversation-core/ChildCountConversationStateExtractor.ts',
      ),
    ).not.toContain('input.currentState');
    expect(
      readSrc(
        'src/features/conversation-core/InfantCountConversationStateExtractor.ts',
      ),
    ).not.toContain('input.currentState');
  });

  it.each([
    {
      name: 'flights adult question + bare 1',
      message: '1',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      },
      field: 'adultCount' as const,
      value: 1,
      ack: ACKS.adultCount(1),
      nextFollowUp: CHILD_Q,
    },
    {
      name: 'flights adult question + bare 2',
      message: '2',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      },
      field: 'adultCount' as const,
      value: 2,
      ack: ACKS.adultCount(2),
      nextFollowUp: CHILD_Q,
    },
    {
      name: 'accommodation guest question + bare 2',
      message: '2',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        accommodationRequested: true,
      },
      field: 'adultCount' as const,
      value: 2,
      ack: ACKS.adultCount(2),
      nextFollowUp: CHILD_Q,
    },
    {
      name: 'child question + bare 1',
      message: '1',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: null,
        flightsRequested: true,
      },
      field: 'childCount' as const,
      value: 1,
      ack: ACKS.childCount(1),
      nextFollowUp: INFANT_Q,
    },
    {
      name: 'child question + bare 2',
      message: '2',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: null,
        flightsRequested: true,
      },
      field: 'childCount' as const,
      value: 2,
      ack: ACKS.childCount(2),
      nextFollowUp: INFANT_Q,
    },
    {
      name: 'infant question + bare 1',
      message: '1',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 1,
        infantCount: null,
        flightsRequested: true,
      },
      field: 'infantCount' as const,
      value: 1,
      ack: ACKS.infantCount(1),
      nextFollowUp: NEUTRAL,
    },
    {
      name: 'infant question + bare 2',
      message: '2',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 1,
        infantCount: null,
        flightsRequested: true,
      },
      field: 'infantCount' as const,
      value: 2,
      ack: ACKS.infantCount(2),
      nextFollowUp: NEUTRAL,
    },
  ])(
    '$name → extracts, acknowledges, progresses',
    ({ message, seed, field, value, ack, nextFollowUp }) => {
      const before = createState(seed);
      expect(selectConversationFollowUpQuestion(before)).not.toBe(NEUTRAL);

      const t = turn(message, seed);
      expect(t.extracted).toEqual({ [field]: value });
      expect(t.state[field]).toBe(value);
      expect(t.classification.hasInterpretedChange).toBe(true);
      expect(t.classification.newlyPopulated).toContain(field);
      expect(t.components.acknowledgement).toBe(ack);
      expect(t.reply).toMatch(
        field === 'adultCount'
          ? /adult/i
          : field === 'childCount'
            ? /child/i
            : /infant/i,
      );
      expect(t.components.followUpQuestion).toBe(nextFollowUp);
      expect(t.reply).toContain(nextFollowUp);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it.each([
    {
      name: 'bare 2 without passenger services',
      message: '2',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
      },
      activeQuestion: NEUTRAL,
    },
    {
      name: 'bare 2 after passenger progression is complete',
      message: '2',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 2,
        infantCount: 1,
        flightsRequested: true,
      },
      activeQuestion: NEUTRAL,
    },
  ])('$name → remains uninterpreted', ({ message, seed, activeQuestion }) => {
    const before = createState(seed);
    expect(selectConversationFollowUpQuestion(before)).toBe(activeQuestion);

    const t = turn(message, seed);
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBe(before.adultCount);
    expect(t.state.childCount).toBe(before.childCount);
    expect(t.state.infantCount).toBe(before.infantCount);
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(activeQuestion);
    assertSingleSelectedQuestion(t.reply);
  });

  it.each([
    { name: 'invalid 0', message: '0' },
    { name: 'invalid 100', message: '100' },
    { name: 'invalid negative', message: '-1' },
    { name: 'invalid decimal', message: '1.5' },
  ])(
    '$name while adult question active → no extraction; adult Q remains',
    ({ message }) => {
      const seed = {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      };
      const t = turn(message, seed);
      expect(t.extracted).toEqual({});
      expect(t.state.adultCount).toBeNull();
      expect(t.classification.hasInterpretedChange).toBe(false);
      expect(t.components.acknowledgement).toBeNull();
      expect(t.components.followUpQuestion).toBe(ADULT_Q);
      expect(t.reply).toContain(ADULT_Q);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it('unsupported non-number while passenger question active → no ack; question remains', () => {
    const adult = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(adult.extracted).toEqual({});
    expect(adult.components.acknowledgement).toBeNull();
    expect(adult.components.followUpQuestion).toBe(ADULT_Q);
    assertSingleSelectedQuestion(adult.reply);

    const child = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      flightsRequested: true,
    });
    expect(child.extracted).toEqual({});
    expect(child.components.acknowledgement).toBeNull();
    expect(child.components.followUpQuestion).toBe(CHILD_Q);
    assertSingleSelectedQuestion(child.reply);

    const infant = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 1,
      infantCount: null,
      flightsRequested: true,
    });
    expect(infant.extracted).toEqual({});
    expect(infant.components.acknowledgement).toBeNull();
    expect(infant.components.followUpQuestion).toBe(INFANT_Q);
    assertSingleSelectedQuestion(infant.reply);
  });

  it('bare-number extractor does not claim guest-noun or multi-passenger sentences', () => {
    // Phase 19J/19K own guest nouns and combined passenger sentences on the
    // composite path; bare-number extractor alone must ignore them.
    const guestActive = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(
      new BareNumberPassengerCountConversationStateExtractor().extract({
        message: '2 guests',
        currentState: guestActive,
      }),
    ).toEqual({ stateUpdate: {} });

    const flightsActive = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(
      new BareNumberPassengerCountConversationStateExtractor().extract({
        message: '2 adults and 1 child',
        currentState: flightsActive,
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('repeated equal bare number after capture → no false changed event / no duplicate ack', () => {
    const t = turn('2', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBe(2);
    expect(t.state.childCount).toBe(2);
    expect(t.state.infantCount).toBe(1);
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.classification.newlyPopulated).not.toContain('adultCount');
    expect(t.classification.updated).not.toContain('adultCount');
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    assertSingleSelectedQuestion(t.reply);
  });

  it('accommodation guest bare answer uses adult acknowledgement wording', () => {
    const t = turn('2', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(t.state.adultCount).toBe(2);
    expect(t.components.acknowledgement).toBe(ACKS.adultCount(2));
    expect(t.reply).toMatch(/adult/i);
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).not.toContain(GUEST_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('infant bare answer continues to terminal neutral when no later contextual gap', () => {
    const t = turn('1', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 0,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.state.infantCount).toBe(1);
    expect(t.components.acknowledgement).toBe(ACKS.infantCount(1));
    expect(t.reply).toMatch(/infant/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
    assertSingleSelectedQuestion(t.reply);
  });

  it('classifies as interpreted only when bare-number extraction occurs', () => {
    const interpreted = turn('2', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(interpreted.classification.hasInterpretedChange).toBe(true);

    const uninterpreted = turn('2', {
      ...COMPLETE_CORE,
      adultCount: null,
    });
    expect(uninterpreted.classification.hasInterpretedChange).toBe(false);
  });

  it('preserves single-question invariant across bare-number passenger turns', () => {
    const turns = [
      turn('2', {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      }),
      turn('1', {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: null,
        flightsRequested: true,
      }),
      turn('1', {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 1,
        infantCount: null,
        flightsRequested: true,
      }),
      turn('0', {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      }),
    ];
    for (const t of turns) {
      assertSingleSelectedQuestion(t.reply);
    }
  });
});
