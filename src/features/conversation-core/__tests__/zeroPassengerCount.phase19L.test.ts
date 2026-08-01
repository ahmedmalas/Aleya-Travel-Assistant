import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { BareNumberPassengerCountConversationStateExtractor } from '../BareNumberPassengerCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { ExplicitGuestCountConversationStateExtractor } from '../ExplicitGuestCountConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { MultiPassengerCountConversationStateExtractor } from '../MultiPassengerCountConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 19L — zero child/infant passenger counts (not adult).
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
      conversationId: 'conversation-19l',
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
    userEntryId: 'user-19l',
    assistantEntryId: 'assistant-19l',
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

describe('Phase 19L — zero child and infant passenger counts', () => {
  it('locks zero-domain ownership across bare-number, child, infant, and multi extractors', () => {
    const bare = readSrc(
      'src/features/conversation-core/BareNumberPassengerCountConversationStateExtractor.ts',
    );
    expect(bare).toContain('Phase 19L');
    expect(bare).toContain("field === 'adultCount' ? 1 : 0");

    const child = readSrc(
      'src/features/conversation-core/ChildCountConversationStateExtractor.ts',
    );
    expect(child).toContain('Phase 19L');
    expect(child).toContain('ZERO_CHILD_COUNT_MESSAGE');

    const infant = readSrc(
      'src/features/conversation-core/InfantCountConversationStateExtractor.ts',
    );
    expect(infant).toContain('Phase 19L');
    expect(infant).toContain('ZERO_INFANT_COUNT_MESSAGE');

    const multi = readSrc(
      'src/features/conversation-core/MultiPassengerCountConversationStateExtractor.ts',
    );
    expect(multi).toContain('Phase 19L');
    expect(multi).toContain('ZERO_SEGMENT_PATTERN');

    const adult = readSrc(
      'src/features/conversation-core/AdultCountConversationStateExtractor.ts',
    );
    expect(adult).toContain('fromDigits < 1');
  });

  it.each([
    { name: 'bare 0', message: '0' },
    { name: '0 children', message: '0 children' },
    { name: 'no children', message: 'no children' },
    { name: 'There are no children', message: 'There are no children' },
    { name: 'We have no children', message: 'We have no children' },
  ])(
    'child follow-up + $name → childCount=0; infant Q; adult ack priority unused',
    ({ message }) => {
      const t = turn(message, {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      });
      expect(t.extracted).toEqual({ childCount: 0 });
      expect(t.state.childCount).toBe(0);
      expect(t.state.adultCount).toBe(2);
      expect(t.state.infantCount).toBeNull();
      expect(t.classification.hasInterpretedChange).toBe(true);
      expect(t.components.acknowledgement).toBe(ACKS.childCount(0));
      expect(t.components.followUpQuestion).toBe(INFANT_Q);
      expect(t.reply).toContain(INFANT_Q);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it.each([
    { name: 'bare 0', message: '0' },
    { name: '0 infants', message: '0 infants' },
    { name: 'no infants', message: 'no infants' },
    { name: 'There are no infants', message: 'There are no infants' },
    { name: 'We have no infants', message: 'We have no infants' },
  ])(
    'infant follow-up + $name → infantCount=0; neutral continuation',
    ({ message }) => {
      const t = turn(message, {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 0,
        infantCount: null,
        flightsRequested: true,
      });
      expect(t.extracted).toEqual({ infantCount: 0 });
      expect(t.state.infantCount).toBe(0);
      expect(t.state.childCount).toBe(0);
      expect(t.classification.hasInterpretedChange).toBe(true);
      expect(t.components.acknowledgement).toBe(ACKS.infantCount(0));
      expect(t.components.followUpQuestion).toBe(NEUTRAL);
      expect(t.reply).toContain(NEUTRAL);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it('bare 0 rejected during adult follow-up', () => {
    const t = turn('0', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('bare 0 rejected during accommodation guest follow-up', () => {
    const before = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(selectConversationFollowUpQuestion(before)).toBe(GUEST_Q);

    const t = turn('0', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(GUEST_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it.each([
    {
      name: '2 adults and 0 children',
      message: '2 adults and 0 children',
      expected: { adultCount: 2, childCount: 0 },
      next: INFANT_Q,
      ack: ACKS.adultCount(2),
    },
    {
      name: '2 adults, 0 children and 1 infant',
      message: '2 adults, 0 children and 1 infant',
      expected: { adultCount: 2, childCount: 0, infantCount: 1 },
      next: NEUTRAL,
      ack: ACKS.adultCount(2),
    },
    {
      name: '2 adults and no infants',
      message: '2 adults and no infants',
      expected: { adultCount: 2, infantCount: 0 },
      next: CHILD_Q,
      ack: ACKS.adultCount(2),
    },
    {
      name: '2 adults, no children and no infants',
      message: '2 adults, no children and no infants',
      expected: { adultCount: 2, childCount: 0, infantCount: 0 },
      next: NEUTRAL,
      ack: ACKS.adultCount(2),
    },
    {
      name: '2 adults, 0 children and 0 infants',
      message: '2 adults, 0 children and 0 infants',
      expected: { adultCount: 2, childCount: 0, infantCount: 0 },
      next: NEUTRAL,
      ack: ACKS.adultCount(2),
    },
  ])(
    'multi-passenger $name → atomic update; ack priority adult; progression',
    ({ message, expected, next, ack }) => {
      const t = turn(message, {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      });
      expect(t.extracted).toEqual(expected);
      for (const [field, value] of Object.entries(expected)) {
        expect(t.state[field as keyof typeof expected]).toBe(value);
      }
      expect(t.classification.hasInterpretedChange).toBe(true);
      expect(t.components.acknowledgement).toBe(ack);
      expect(t.components.followUpQuestion).toBe(next);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it('adult zero rejects entire multi extraction with no partial update', () => {
    const t = turn('0 adults and 1 child', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.state.childCount).toBeNull();
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
    assertSingleSelectedQuestion(t.reply);

    expect(
      new ChildCountConversationStateExtractor().extract({
        message: '0 adults and 1 child',
        currentState: createState({ flightsRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new AdultCountConversationStateExtractor().extract({
        message: '0 adults and 1 child',
        currentState: createState({ flightsRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it.each([
    { name: 'negative child', message: '-1 children' },
    { name: 'decimal child', message: '1.5 children' },
    { name: '100 children', message: '100 children' },
    { name: 'negative multi', message: '2 adults and -1 children' },
    { name: 'decimal multi', message: '2 adults and 1.5 children' },
    { name: '100 multi child', message: '2 adults and 100 children' },
    { name: 'no adults multi', message: 'no adults and 1 child' },
  ])('$name → rejected; no passenger mutation', ({ message }) => {
    const seed = {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    };
    const before = createState(seed);
    const t = turn(message, seed);
    expect(t.extracted.adultCount).toBeUndefined();
    expect(t.extracted.childCount).toBeUndefined();
    expect(t.extracted.infantCount).toBeUndefined();
    expect(t.state.adultCount).toBe(before.adultCount);
    expect(t.state.childCount).toBeNull();
    expect(t.state.infantCount).toBeNull();
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
  });

  it('omitted categories remain unchanged; explicit zero does not invent the other', () => {
    const t = turn('2 adults and 0 children', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.state.adultCount).toBe(2);
    expect(t.state.childCount).toBe(0);
    expect(t.state.infantCount).toBeNull();
    expect(t.extracted.infantCount).toBeUndefined();
  });

  it('existing zero values remain unchanged on repeat', () => {
    const t = turn('0 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 0,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.state.childCount).toBe(0);
    expect(t.classification.newlyPopulated).not.toContain('childCount');
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('service-gated: multi zero phrases ignored outside flights/accommodation', () => {
    const t = turn('2 adults and 0 children', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.state.childCount).toBeNull();
  });

  it('out-of-context bare 0 does not mutate passenger state', () => {
    const t = turn('0', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.state.childCount).toBeNull();
    expect(t.state.infantCount).toBeNull();
  });

  it('extractor collision prevention: single-category extractors defer multi zero phrases', () => {
    const currentState = createState({ flightsRequested: true });
    const message = '2 adults, no children and no infants';
    expect(
      new MultiPassengerCountConversationStateExtractor().extract({
        message,
        currentState,
      }),
    ).toEqual({
      stateUpdate: { adultCount: 2, childCount: 0, infantCount: 0 },
    });
    expect(
      new AdultCountConversationStateExtractor().extract({
        message,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new ChildCountConversationStateExtractor().extract({
        message,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new InfantCountConversationStateExtractor().extract({
        message,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new BareNumberPassengerCountConversationStateExtractor().extract({
        message,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new ExplicitGuestCountConversationStateExtractor().extract({
        message,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('zero child then zero infant completes passenger progression', () => {
    const afterChild = turn('no children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(afterChild.state.childCount).toBe(0);
    expect(afterChild.components.followUpQuestion).toBe(INFANT_Q);

    const afterInfant = turn('no infants', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 0,
      infantCount: null,
      flightsRequested: true,
    });
    expect(afterInfant.state.infantCount).toBe(0);
    expect(afterInfant.components.followUpQuestion).toBe(NEUTRAL);
    assertSingleSelectedQuestion(afterChild.reply);
    assertSingleSelectedQuestion(afterInfant.reply);
  });

  it('preserves single-question invariant across zero-count turns', () => {
    const turns = [
      turn('0', {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: null,
        flightsRequested: true,
      }),
      turn('0', {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 0,
        infantCount: null,
        flightsRequested: true,
      }),
      turn('2 adults, 0 children and 0 infants', {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
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

  it('accommodation context accepts multi zero child phrase', () => {
    const t = turn('2 adults and 0 children', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      accommodationRequested: true,
    });
    expect(t.extracted).toEqual({ adultCount: 2, childCount: 0 });
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    assertSingleSelectedQuestion(t.reply);
  });
});
