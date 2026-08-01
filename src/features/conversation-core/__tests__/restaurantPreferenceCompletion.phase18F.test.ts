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
import { RestaurantPreferenceConversationStateExtractor } from '../RestaurantPreferenceConversationStateExtractor';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 18F — restaurant preference persistence and follow-up completion.
 */

const ROOT = process.cwd();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const RESTAURANTS_Q = FOLLOW_UPS.restaurants;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const COMPOSITE = createConversationStateExtractor();
const PREFERENCE = new RestaurantPreferenceConversationStateExtractor();

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
  adultCount: 2,
} as const;

const CANONICAL_PREFERENCES: Array<{ message: string; value: string }> = [
  { message: 'Italian', value: 'Italian' },
  { message: 'Italian food', value: 'Italian' },
  { message: 'seafood', value: 'seafood' },
  { message: 'We would like seafood', value: 'seafood' },
  { message: 'looking for seafood', value: 'seafood' },
  { message: 'fine dining', value: 'fine dining' },
  { message: 'Fine dining', value: 'fine dining' },
  { message: 'Something casual', value: 'casual dining' },
  { message: 'casual dining', value: 'casual dining' },
  { message: 'family-friendly restaurants', value: 'family-friendly restaurants' },
  { message: 'halal food', value: 'halal food' },
  { message: 'Halal restaurants', value: 'halal food' },
  { message: 'vegetarian food', value: 'vegetarian food' },
  { message: 'We prefer local cuisine', value: 'local cuisine' },
  { message: 'local cuisine', value: 'local cuisine' },
];

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-18f',
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
    userEntryId: 'user-18f',
    assistantEntryId: 'assistant-18f',
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

describe('Phase 18F — restaurant preference completion', () => {
  it('locks the restaurantPreference field, extractor registration, and selector predicate', () => {
    const types = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/types.ts'),
      'utf8',
    );
    expect(types).toMatch(/restaurantPreference:\s*string \| null/);
    expect(types).toContain('restaurantPreference: null');

    const factory = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/createConversationStateExtractor.ts',
      ),
      'utf8',
    );
    expect(factory).toContain('RestaurantPreferenceConversationStateExtractor');
    expect(factory).toMatch(
      /new RestaurantsRequestedConversationStateExtractor\(\),\s*new RestaurantPreferenceConversationStateExtractor\(\),/,
    );

    const selector = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
      ),
      'utf8',
    );
    expect(selector).toContain('Phase 18F');
    expect(selector).toMatch(
      /state\.restaurantsRequested === true &&\s*state\.restaurantPreference === null/,
    );
  });

  it('initializes restaurantPreference as null', () => {
    expect(createState().restaurantPreference).toBeNull();
  });

  it('extracts canonical preferences only when restaurantsRequested is true', () => {
    const active = createState({
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    const inactive = createState({
      ...COMPLETE_CORE,
      restaurantsRequested: null,
    });
    for (const entry of CANONICAL_PREFERENCES) {
      expect(
        PREFERENCE.extract({ message: entry.message, currentState: active })
          .stateUpdate,
        entry.message,
      ).toEqual({ restaurantPreference: entry.value });
      expect(
        PREFERENCE.extract({ message: entry.message, currentState: inactive })
          .stateUpdate,
        `${entry.message} inactive`,
      ).toEqual({});
    }
  });

  it('does not claim preference ownership without restaurantsRequested', () => {
    const t = turn('seafood', COMPLETE_CORE);
    expect(t.extracted).toEqual({});
    expect(t.state.restaurantPreference).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('keeps dining follow-up when restaurants are enabled with no preference', () => {
    const state = createState({
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(RESTAURANTS_Q);
  });

  it('persists preference and suppresses dining follow-up for Italian, seafood, and fine dining', () => {
    for (const entry of [
      { message: 'Italian', value: 'Italian' },
      { message: 'looking for seafood', value: 'seafood' },
      { message: 'fine dining', value: 'fine dining' },
    ]) {
      const t = turn(entry.message, {
        ...COMPLETE_CORE,
        restaurantsRequested: true,
      });
      expect(t.state.restaurantPreference, entry.message).toBe(entry.value);
      expect(t.classification.newlyPopulated, entry.message).toContain(
        'restaurantPreference',
      );
      expect(t.components.followUpQuestion, entry.message).toBe(NEUTRAL);
      expect(t.reply, entry.message).not.toContain(RESTAURANTS_Q);
    }
  });

  it('asks the next required field after restaurants are satisfied', () => {
    const incomplete = turn('seafood', {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      restaurantsRequested: true,
    });
    expect(incomplete.state.restaurantPreference).toBe('seafood');
    expect(incomplete.components.followUpQuestion).toBe(FOLLOW_UPS.returnDate);
  });

  it('uses terminal continuation when restaurants are satisfied and the trip is complete', () => {
    const t = turn('Italian', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
  });

  it('treats repeated identical preference as unchanged with no restaurant re-request', () => {
    const t = turn('seafood', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'seafood',
    });
    expect(t.extracted).toEqual({ restaurantPreference: 'seafood' });
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.classification.newlyPopulated).toEqual([]);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
  });

  it('updates a changed preference without re-requesting dining', () => {
    const t = turn('Italian', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'seafood',
    });
    expect(t.state.restaurantPreference).toBe('Italian');
    expect(t.classification.updated).toContain('restaurantPreference');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
  });

  it('preserves Phase 18B unsupported behaviour after preference is captured', () => {
    const previous = createState({
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'seafood',
    });
    const result = processConversationTurn({
      message: "I'm not sure",
      state: previous,
      userEntryId: 'user-18f-u',
      assistantEntryId: 'assistant-18f-u',
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
    expect(classification.hasInterpretedChange).toBe(false);
    expect(components.acknowledgement).toBeNull();
    expect(components.followUpQuestion).toBe(NEUTRAL);
    expect(result.reply).not.toContain(RESTAURANTS_Q);
  });

  it('covers the public enable-then-preference journey', () => {
    let state = createState(COMPLETE_CORE);
    const first = processConversationTurn({
      message: 'find restaurants',
      state,
      userEntryId: 'u1',
      assistantEntryId: 'a1',
      userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    });
    expect(first.state.restaurantsRequested).toBe(true);
    expect(first.reply).toContain(RESTAURANTS_Q);
    state = first.state;
    const second = processConversationTurn({
      message: 'looking for seafood',
      state,
      userEntryId: 'u2',
      assistantEntryId: 'a2',
      userMessageAt: new Date('2026-07-29T00:00:02.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:03.000Z'),
    });
    expect(second.state.restaurantPreference).toBe('seafood');
    expect(second.reply).not.toContain(RESTAURANTS_Q);
  });
});
