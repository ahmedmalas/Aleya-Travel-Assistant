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
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 19E — restaurant-preference-specific acknowledgement.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const RESTAURANTS_Q = FOLLOW_UPS.restaurants;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const RETURN_Q = FOLLOW_UPS.returnDate;
const GENERIC = ACKS.genericTravelFieldChange;
const SELECTABLE_QUESTIONS = Object.values(FOLLOW_UPS);

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
  adultCount: 2,
} as const;

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-19e',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(
  message: string,
  seed: Partial<ConversationCoreState> = {},
) {
  const previous = createState(seed);
  const extracted = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-19e',
    assistantEntryId: 'assistant-19e',
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
  const selected = selectConversationAcknowledgement(
    result.state,
    classification,
  );
  return {
    previous,
    extracted,
    classification,
    components,
    selected,
    state: result.state,
    reply: result.reply,
  };
}

/** At most one catalogue follow-up / continuation may appear in a reply. */
function assertSingleSelectedQuestion(reply: string): void {
  expect(
    SELECTABLE_QUESTIONS.filter((question) => reply.includes(question)).length,
  ).toBeLessThanOrEqual(1);
}

describe('Phase 19E — restaurant preference acknowledgement', () => {
  it('locks catalogue, selector, event field, and transform ownership', () => {
    expect(ACKS.restaurantPreference('seafood')).toBe('Great — seafood.');
    expect(ACKS.restaurantPreference('Italian')).toBe('Great — Italian.');
    expect(ACKS.restaurantPreference('fine dining')).toBe(
      'Great — fine dining.',
    );

    const selector = readSrc(
      'src/features/conversation-core/selectConversationAcknowledgement.ts',
    );
    expect(selector).toContain("'restaurantPreference'");
    expect(selector).toContain(
      'CONVERSATION_REPLY_CATALOGUE.acknowledgements.restaurantPreference',
    );

    const event = readSrc(
      'src/features/conversation-core/conversationAcknowledgementEvent.ts',
    );
    expect(event).toContain("| 'restaurantPreference'");

    const transform = readSrc(
      'src/features/conversation-core/transformBaselineAcknowledgement.ts',
    );
    expect(transform).toContain('restaurantPreference');
    expect(transform).toContain('instead.');
  });

  it.each([
    { message: 'Italian', value: 'Italian' },
    { message: 'looking for seafood', value: 'seafood' },
    { message: 'fine dining', value: 'fine dining' },
  ] as const)(
    'first preference %# $value → specific set acknowledgement, dining suppressed',
    ({ message, value }) => {
      const t = turn(message, {
        ...COMPLETE_CORE,
        restaurantsRequested: true,
      });
      expect(t.state.restaurantPreference).toBe(value);
      expect(t.classification.newlyPopulated).toContain('restaurantPreference');
      expect(t.selected).toEqual({
        text: ACKS.restaurantPreference(value),
        event: { kind: 'field-set', field: 'restaurantPreference' },
      });
      expect(t.components.acknowledgement).toBe(
        ACKS.restaurantPreference(value),
      );
      expect(t.components.acknowledgement).not.toBe(GENERIC);
      expect(t.components.followUpQuestion).toBe(NEUTRAL);
      expect(t.reply).toContain(ACKS.restaurantPreference(value));
      expect(t.reply).not.toContain(GENERIC);
      expect(t.reply).not.toContain(RESTAURANTS_Q);
      assertSingleSelectedQuestion(t.reply);
    },
  );

  it('changed preference → field-changed event and instead wording in reply', () => {
    const t = turn('fine dining', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'Italian',
    });
    expect(t.state.restaurantPreference).toBe('fine dining');
    expect(t.classification.updated).toContain('restaurantPreference');
    expect(t.classification.newlyPopulated).not.toContain(
      'restaurantPreference',
    );
    expect(t.selected).toEqual({
      text: ACKS.restaurantPreference('fine dining'),
      event: { kind: 'field-changed', field: 'restaurantPreference' },
    });
    expect(t.components.acknowledgement).toBe(
      ACKS.restaurantPreference('fine dining'),
    );
    expect(t.components.acknowledgement).not.toBe(GENERIC);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain('Great — fine dining instead.');
    expect(t.reply).not.toContain(GENERIC);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('repeated unchanged preference → no acknowledgement and no dining re-request', () => {
    const t = turn('seafood', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'seafood',
    });
    expect(t.state.restaurantPreference).toBe('seafood');
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.selected).toBeNull();
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(GENERIC);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    expect(t.reply).not.toMatch(/Great — seafood/);
    assertSingleSelectedQuestion(t.reply);
  });

  it('acknowledgement plus next required follow-up when return date is missing', () => {
    const t = turn('seafood', {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      restaurantsRequested: true,
    });
    expect(t.state.restaurantPreference).toBe('seafood');
    expect(t.components.acknowledgement).toBe(
      ACKS.restaurantPreference('seafood'),
    );
    expect(t.components.followUpQuestion).toBe(RETURN_Q);
    expect(t.reply).toContain(ACKS.restaurantPreference('seafood'));
    expect(t.reply).toContain(RETURN_Q);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('acknowledgement plus terminal continuation when the trip is otherwise complete', () => {
    const t = turn('Italian', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    expect(t.components.acknowledgement).toBe(
      ACKS.restaurantPreference('Italian'),
    );
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(ACKS.restaurantPreference('Italian'));
    expect(t.reply).toContain(NEUTRAL);
    assertSingleSelectedQuestion(t.reply);
  });

  it('unsupported input after preference completion → no acknowledgement', () => {
    const t = turn("I'm not sure yet", {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'seafood',
    });
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(GENERIC);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    assertSingleSelectedQuestion(t.reply);
  });

  it('never uses generic Perfect. for a restaurantPreference update', () => {
    const first = turn('Italian', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    const changed = turn('seafood', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'Italian',
    });
    for (const t of [first, changed]) {
      expect(t.components.acknowledgement).not.toBe(GENERIC);
      expect(t.components.acknowledgementEvent?.kind).not.toBe('generic');
      expect(t.reply).not.toContain('Perfect, got it.');
      expect(t.reply.includes(GENERIC) || t.reply.includes('Perfect.')).toBe(
        false,
      );
    }
  });

  it('transform distinguishes set versus changed without destination collision', () => {
    const setText = ACKS.restaurantPreference('seafood');
    expect(
      transformBaselineAcknowledgement(setText, {
        kind: 'field-set',
        field: 'restaurantPreference',
      }),
    ).toBe('Great — seafood.');
    expect(
      transformBaselineAcknowledgement(setText, {
        kind: 'field-changed',
        field: 'restaurantPreference',
      }),
    ).toBe('Great — seafood instead.');

    // Destination still owns the same catalogue shape when its event is set.
    expect(
      transformBaselineAcknowledgement(ACKS.destination('Cairns'), {
        kind: 'field-set',
        field: 'destination',
      }),
    ).toBe('Great, Cairns it is.');
    expect(
      transformBaselineAcknowledgement(ACKS.destination('Hobart'), {
        kind: 'field-changed',
        field: 'destination',
      }),
    ).toBe('Updated — Hobart it is.');
  });
});
