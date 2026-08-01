import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
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
 * Phase 19K — multi-passenger count answers in one message.
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
      conversationId: 'conversation-19k',
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
    userEntryId: 'user-19k',
    assistantEntryId: 'assistant-19k',
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

describe('Phase 19K — multi-passenger extraction', () => {
  it('locks multi-passenger ownership before Adult/Child/Infant extractors', () => {
    const factory = readSrc(
      'src/features/conversation-core/createConversationStateExtractor.ts',
    );
    expect(factory).toMatch(
      /new MultiPassengerCountConversationStateExtractor\(\),\s*new AdultCountConversationStateExtractor\(\)/,
    );

    const multi = readSrc(
      'src/features/conversation-core/MultiPassengerCountConversationStateExtractor.ts',
    );
    expect(multi).toContain('Phase 19K');
    expect(multi).toContain('isPassengerServiceRelevant');
    expect(multi).toContain('input.currentState');

    expect(
      readSrc(
        'src/features/conversation-core/ChildCountConversationStateExtractor.ts',
      ),
    ).toContain('Phase 19K');
    expect(
      readSrc(
        'src/features/conversation-core/InfantCountConversationStateExtractor.ts',
      ),
    ).toContain('Phase 19K');
  });

  it.each([
    {
      name: '2 adults and 1 child',
      message: '2 adults and 1 child',
      expected: { adultCount: 2, childCount: 1 },
      next: INFANT_Q,
    },
    {
      name: '2 adults, 1 child and 1 infant',
      message: '2 adults, 1 child and 1 infant',
      expected: { adultCount: 2, childCount: 1, infantCount: 1 },
      next: NEUTRAL,
    },
    {
      name: '1 adult and 2 children',
      message: '1 adult and 2 children',
      expected: { adultCount: 1, childCount: 2 },
      next: INFANT_Q,
    },
    {
      name: '1 adult and 1 infant',
      message: '1 adult and 1 infant',
      expected: { adultCount: 1, infantCount: 1 },
      next: CHILD_Q,
    },
    {
      name: '2 children and 1 infant',
      message: '2 children and 1 infant',
      expected: { childCount: 2, infantCount: 1 },
      next: ADULT_Q,
    },
    {
      name: 'We have 2 adults and 1 child',
      message: 'We have 2 adults and 1 child',
      expected: { adultCount: 2, childCount: 1 },
      next: INFANT_Q,
    },
    {
      name: 'There will be 2 adults, 2 children and 1 infant',
      message: 'There will be 2 adults, 2 children and 1 infant',
      expected: { adultCount: 2, childCount: 2, infantCount: 1 },
      next: NEUTRAL,
    },
    {
      name: 'Travelling with 2 adults and 1 child',
      message: 'Travelling with 2 adults and 1 child',
      expected: { adultCount: 2, childCount: 1 },
      next: INFANT_Q,
    },
    {
      name: 'alternate order 1 child and 2 adults',
      message: '1 child and 2 adults',
      expected: { adultCount: 2, childCount: 1 },
      next: INFANT_Q,
    },
    {
      name: 'alternate order 1 infant, 2 adults and 1 child',
      message: '1 infant, 2 adults and 1 child',
      expected: { adultCount: 2, childCount: 1, infantCount: 1 },
      next: NEUTRAL,
    },
  ])(
    'flights context + $name → combined update, adult ack priority, next follow-up',
    ({ message, expected, next }) => {
      const seed = {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      };
      const t = turn(message, seed);
      expect(t.extracted).toEqual(expected);
      for (const [field, value] of Object.entries(expected)) {
        expect(t.state[field as keyof typeof expected]).toBe(value);
      }
      expect(t.classification.hasInterpretedChange).toBe(true);
      // Acknowledgement priority: adult → child → infant.
      // Table cases always include adult and/or child; adult wins when present.
      if ('adultCount' in expected) {
        expect(t.components.acknowledgement).toBe(
          ACKS.adultCount(expected.adultCount!),
        );
      } else {
        expect(t.components.acknowledgement).toBe(
          ACKS.childCount(expected.childCount!),
        );
      }
      expect(t.components.followUpQuestion).toBe(next);
      expect(t.reply).toContain(next);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it('accommodation guest context + "2 adults and 1 child" → adult+child; infant Q', () => {
    const t = turn('2 adults and 1 child', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      accommodationRequested: true,
    });
    expect(t.extracted).toEqual({ adultCount: 2, childCount: 1 });
    expect(t.state.adultCount).toBe(2);
    expect(t.state.childCount).toBe(1);
    expect(t.state.infantCount).toBeNull();
    expect(t.components.acknowledgement).toBe(ACKS.adultCount(2));
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    expect(t.reply).not.toContain(GUEST_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('out-of-context multi-passenger message → no passenger update (Phase 19H gate)', () => {
    const t = turn('2 adults and 1 child', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
    });
    expect(t.extracted.adultCount).toBeUndefined();
    expect(t.extracted.childCount).toBeUndefined();
    expect(t.state.adultCount).toBeNull();
    expect(t.state.childCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
  });

  it('omitted categories remain unchanged; no zero defaults', () => {
    const withInfantOpen = turn('2 adults and 1 child', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(withInfantOpen.state.infantCount).toBeNull();
    expect(withInfantOpen.components.followUpQuestion).toBe(INFANT_Q);

    const adultAndInfant = turn('1 adult and 1 infant', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(adultAndInfant.state.childCount).toBeNull();
    expect(adultAndInfant.components.followUpQuestion).toBe(CHILD_Q);

    const childrenAndInfant = turn('2 children and 1 infant', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(childrenAndInfant.state.adultCount).toBeNull();
    expect(childrenAndInfant.components.followUpQuestion).toBe(ADULT_Q);
  });

  it('repeated identical multi-passenger message → no false changed / no duplicate ack', () => {
    const t = turn('2 adults and 1 child', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({ adultCount: 2, childCount: 1 });
    expect(t.classification.newlyPopulated).not.toContain('adultCount');
    expect(t.classification.updated).not.toContain('adultCount');
    expect(t.classification.newlyPopulated).not.toContain('childCount');
    expect(t.classification.updated).not.toContain('childCount');
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    assertSingleSelectedQuestion(t.reply);
  });

  it('changed multi-passenger values update included fields only', () => {
    const t = turn('3 adults and 2 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 1,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.state.adultCount).toBe(3);
    expect(t.state.childCount).toBe(2);
    expect(t.state.infantCount).toBeNull();
    expect(t.classification.updated).toContain('adultCount');
    expect(t.classification.updated).toContain('childCount');
    expect(t.components.acknowledgement).toBe(ACKS.adultCount(3));
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
  });

  it('equal adult restatement with new child → adult unchanged; child newly set; adult ack not emitted for equal', () => {
    const t = turn('2 adults and 1 child', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.state.adultCount).toBe(2);
    expect(t.state.childCount).toBe(1);
    expect(t.classification.updated).not.toContain('adultCount');
    expect(t.classification.newlyPopulated).toContain('childCount');
    // Adult field is in the update but unchanged; child is newly populated.
    // Ack priority still checks adult set/changed first — equal adult yields no
    // adult ack, so child acknowledgement wins.
    expect(t.components.acknowledgement).toBe(ACKS.childCount(1));
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
  });

  it.each([
    { name: 'invalid zero', message: '0 adults and 1 child' },
    { name: 'invalid 100', message: '100 adults and 1 child' },
    { name: 'invalid negative', message: '-1 adults and 1 child' },
    { name: 'invalid decimal', message: '1.5 adults and 1 child' },
    { name: 'word numbers', message: 'two adults and one child' },
    { name: 'question false positive', message: 'Are 2 adults and 1 child allowed?' },
    {
      name: 'pricing/policy false positive',
      message: 'The package price is for 2 adults and 1 child',
    },
    {
      name: 'room allows',
      message: 'The room allows 2 adults and 1 child',
    },
    {
      name: 'hotel recommends',
      message: 'The hotel recommends 2 adults and 1 child per room',
    },
  ])(
    '$name → atomic rejection; no partial passenger updates; adult Q remains',
    ({ message }) => {
      const t = turn(message, {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      });
      expect(t.extracted.adultCount).toBeUndefined();
      expect(t.extracted.childCount).toBeUndefined();
      expect(t.extracted.infantCount).toBeUndefined();
      expect(t.state.adultCount).toBeNull();
      expect(t.state.childCount).toBeNull();
      expect(t.state.infantCount).toBeNull();
      expect(t.components.followUpQuestion).toBe(ADULT_Q);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it('single-category extractors do not partially claim multi-passenger messages', () => {
    const message = '2 adults and 1 child';
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      flightsRequested: true,
    });
    expect(
      new AdultCountConversationStateExtractor().extract({
        message,
        currentState: state,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new ChildCountConversationStateExtractor().extract({
        message,
        currentState: state,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new InfantCountConversationStateExtractor().extract({
        message,
        currentState: state,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new MultiPassengerCountConversationStateExtractor().extract({
        message,
        currentState: state,
      }),
    ).toEqual({ stateUpdate: { adultCount: 2, childCount: 1 } });
  });

  it('preserves single-category, bare-number, and guest ownership', () => {
    expect(
      turn('2 adults', {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      }).state.adultCount,
    ).toBe(2);
    expect(
      turn('2 children', {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: null,
        flightsRequested: true,
      }).state.childCount,
    ).toBe(2);
    expect(
      turn('1 infant', {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 1,
        infantCount: null,
        flightsRequested: true,
      }).state.infantCount,
    ).toBe(1);
    expect(
      turn('2', {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      }).state.adultCount,
    ).toBe(2);
    expect(
      turn('2 guests', {
        ...COMPLETE_CORE,
        adultCount: null,
        accommodationRequested: true,
      }).state.adultCount,
    ).toBe(2);
  });

  it('terminal continuation when all three passenger counts complete', () => {
    const t = turn('2 adults, 1 child and 1 infant', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(t.state.adultCount).toBe(2);
    expect(t.state.childCount).toBe(1);
    expect(t.state.infantCount).toBe(1);
    expect(selectConversationFollowUpQuestion(t.state)).toBe(NEUTRAL);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    assertSingleSelectedQuestion(t.reply);
  });

  it('preserves single-question invariant', () => {
    const turns = [
      turn('2 adults and 1 child', {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      }),
      turn('0 adults and 1 child', {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      }),
      turn('2 adults, 1 child and 1 infant', {
        ...COMPLETE_CORE,
        adultCount: null,
        accommodationRequested: true,
      }),
    ];
    for (const t of turns) {
      assertSingleSelectedQuestion(t.reply);
    }
  });
});
