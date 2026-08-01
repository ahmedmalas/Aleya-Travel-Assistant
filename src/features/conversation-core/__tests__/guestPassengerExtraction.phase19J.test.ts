import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BareNumberPassengerCountConversationStateExtractor } from '../BareNumberPassengerCountConversationStateExtractor';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { ExplicitGuestCountConversationStateExtractor } from '../ExplicitGuestCountConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 19J — explicit guest-count answers map to adultCount when the
 * accommodation guest follow-up is active.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const ADULT_Q = FOLLOW_UPS.flightsAdultCount;
const GUEST_Q = FOLLOW_UPS.accommodationGuestCount;
const CHILD_Q = FOLLOW_UPS.childCount;
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
      conversationId: 'conversation-19j',
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
    userEntryId: 'user-19j',
    assistantEntryId: 'assistant-19j',
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

describe('Phase 19J — explicit guest passenger extraction', () => {
  it('locks guest extractor ownership and active guest-question gate', () => {
    const factory = readSrc(
      'src/features/conversation-core/createConversationStateExtractor.ts',
    );
    expect(factory).toContain('ExplicitGuestCountConversationStateExtractor');

    const guest = readSrc(
      'src/features/conversation-core/ExplicitGuestCountConversationStateExtractor.ts',
    );
    expect(guest).toContain('Phase 19J');
    expect(guest).toContain('isAccommodationGuestCountFollowUpActive');
    expect(guest).toContain('adultCount');
    expect(guest).not.toMatch(/\bguestCount\s*:/);
    expect(guest).not.toContain('selectConversationFollowUpQuestion');

    const context = readSrc(
      'src/features/conversation-core/passengerCountFollowUpContext.ts',
    );
    expect(context).toContain('isAccommodationGuestCountFollowUpActive');
    expect(context).toContain('resolveActivePassengerCountField');

    expect(
      readSrc(
        'src/features/conversation-core/AdultCountConversationStateExtractor.ts',
      ),
    ).not.toContain('guest');
  });

  it.each([
    {
      name: '1 guest',
      message: '1 guest',
      value: 1,
      ack: ACKS.adultCount(1),
    },
    {
      name: '2 guests',
      message: '2 guests',
      value: 2,
      ack: ACKS.adultCount(2),
    },
    {
      name: 'There will be 2 guests',
      message: 'There will be 2 guests',
      value: 2,
      ack: ACKS.adultCount(2),
    },
    {
      name: 'We have 3 guests',
      message: 'We have 3 guests',
      value: 3,
      ack: ACKS.adultCount(3),
    },
    {
      name: 'It will be 4 guests',
      message: 'It will be 4 guests',
      value: 4,
      ack: ACKS.adultCount(4),
    },
  ])(
    'accommodation guest context + $name → adultCount, adult ack, child Q',
    ({ message, value, ack }) => {
      const seed = {
        ...COMPLETE_CORE,
        adultCount: null,
        accommodationRequested: true,
      };
      expect(selectConversationFollowUpQuestion(createState(seed))).toBe(GUEST_Q);

      const t = turn(message, seed);
      expect(t.extracted).toEqual({ adultCount: value });
      expect(t.state.adultCount).toBe(value);
      expect(t.classification.hasInterpretedChange).toBe(true);
      expect(t.classification.newlyPopulated).toContain('adultCount');
      expect(t.components.acknowledgement).toBe(ack);
      expect(t.reply).toMatch(/adult/i);
      expect(t.components.followUpQuestion).toBe(CHILD_Q);
      expect(t.reply).toContain(CHILD_Q);
      expect(t.reply).not.toContain(GUEST_Q);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it('flights-only adult question + "2 guests" → no extraction; adult Q remains', () => {
    const t = turn('2 guests', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
    expect(t.reply).toContain(ADULT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('flights + accommodation + adultCount null + "2 guests" → does not bypass flights-adult Q', () => {
    const seed = {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
      accommodationRequested: true,
    };
    expect(selectConversationFollowUpQuestion(createState(seed))).toBe(ADULT_Q);

    const t = turn('2 guests', seed);
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('no accommodation + "2 guests" → no extraction', () => {
    const t = turn('2 guests', {
      ...COMPLETE_CORE,
      adultCount: null,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
  });

  it('adultCount already captured → guest wording does not re-apply or change (active missing-adult gate)', () => {
    const repeated = turn('2 guests', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      accommodationRequested: true,
    });
    expect(repeated.extracted).toEqual({});
    expect(repeated.state.adultCount).toBe(2);
    expect(repeated.classification.hasInterpretedChange).toBe(false);
    expect(repeated.classification.updated).not.toContain('adultCount');
    expect(repeated.components.acknowledgement).toBeNull();

    const changed = turn('3 guests', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      accommodationRequested: true,
    });
    expect(changed.extracted).toEqual({});
    expect(changed.state.adultCount).toBe(2);
    expect(changed.classification.updated).not.toContain('adultCount');
    expect(changed.components.acknowledgement).toBeNull();
  });

  it.each([
    { name: 'invalid zero', message: '0 guests' },
    { name: 'invalid 100', message: '100 guests' },
    { name: 'invalid negative', message: '-1 guests' },
    { name: 'invalid decimal', message: '1.5 guests' },
    { name: 'word number', message: 'two guests' },
    { name: 'question wording', message: 'Are 2 guests allowed?' },
    { name: 'incidental guest mention', message: 'our guests may arrive later' },
    { name: 'guest room collision', message: 'guest room' },
    { name: 'booking permits', message: 'The booking permits 4 guests' },
    { name: 'hotel charges', message: 'The hotel charges per guest' },
  ])(
    '$name while guest Q active → no adultCount extraction; guest Q remains',
    ({ message }) => {
      const t = turn(message, {
        ...COMPLETE_CORE,
        adultCount: null,
        accommodationRequested: true,
      });
      expect(t.extracted.adultCount).toBeUndefined();
      expect(t.state.adultCount).toBeNull();
      expect(t.classification.newlyPopulated).not.toContain('adultCount');
      expect(t.classification.updated).not.toContain('adultCount');
      expect(t.components.acknowledgement ?? '').not.toMatch(/adult/i);
      expect(t.components.followUpQuestion).toBe(GUEST_Q);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it('does not regress explicit adult / child / infant noun extraction', () => {
    const adults = turn('2 adults', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(adults.state.adultCount).toBe(2);
    expect(adults.components.followUpQuestion).toBe(CHILD_Q);

    const children = turn('2 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      accommodationRequested: true,
    });
    expect(children.state.childCount).toBe(2);

    const infants = turn('1 infant', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 1,
      infantCount: null,
      accommodationRequested: true,
    });
    expect(infants.state.infantCount).toBe(1);
  });

  it('preserves Phase 19I bare-number guest-question answers; no duplicate ownership with guest nouns', () => {
    const bareSeed = {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    };
    const bare = turn('2', bareSeed);
    expect(bare.extracted).toEqual({ adultCount: 2 });
    expect(bare.state.adultCount).toBe(2);
    expect(bare.components.followUpQuestion).toBe(CHILD_Q);

    const guestOnly = new ExplicitGuestCountConversationStateExtractor().extract({
      message: '2',
      currentState: createState(bareSeed),
    });
    expect(guestOnly).toEqual({ stateUpdate: {} });

    const bareOnly = new BareNumberPassengerCountConversationStateExtractor().extract(
      {
        message: '2 guests',
        currentState: createState(bareSeed),
      },
    );
    expect(bareOnly).toEqual({ stateUpdate: {} });

    const guestNoun = turn('2 guests', bareSeed);
    expect(guestNoun.extracted).toEqual({ adultCount: 2 });
    expect(Object.keys(guestNoun.extracted)).toEqual(['adultCount']);
  });

  it('preserves single-question invariant across guest extraction turns', () => {
    const turns = [
      turn('2 guests', {
        ...COMPLETE_CORE,
        adultCount: null,
        accommodationRequested: true,
      }),
      turn('0 guests', {
        ...COMPLETE_CORE,
        adultCount: null,
        accommodationRequested: true,
      }),
      turn('2 guests', {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
        accommodationRequested: true,
      }),
    ];
    for (const t of turns) {
      assertSingleSelectedQuestion(t.reply);
    }
  });
});
