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
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 18G — final closure audit for unsupported input, activity completion,
 * and restaurant preference completion. Audit and characterization only;
 * production behaviour intentionally unchanged.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACTIVITIES_Q = FOLLOW_UPS.activities;
const RESTAURANTS_Q = FOLLOW_UPS.restaurants;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const ORIGIN_Q = FOLLOW_UPS.origin;

/** All catalogue follow-up / continuation questions that may appear once. */
const SELECTABLE_QUESTIONS = [
  FOLLOW_UPS.destination,
  FOLLOW_UPS.origin,
  FOLLOW_UPS.departureDate,
  FOLLOW_UPS.returnDate,
  FOLLOW_UPS.flightsAdultCount,
  FOLLOW_UPS.accommodationGuestCount,
  FOLLOW_UPS.activities,
  FOLLOW_UPS.restaurants,
  FOLLOW_UPS.neutralContinuation,
] as const;

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
  adultCount: 2,
} as const;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-18g',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function countSelectableQuestionsInReply(reply: string): number {
  return SELECTABLE_QUESTIONS.filter((question) => reply.includes(question))
    .length;
}

function assertSingleQuestionInvariant(reply: string, label: string): void {
  expect(
    countSelectableQuestionsInReply(reply),
    `${label}: reply must contain at most one selected follow-up/continuation`,
  ).toBeLessThanOrEqual(1);
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
    userEntryId: 'user-18g',
    assistantEntryId: 'assistant-18g',
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

describe('Phase 18G — unsupported / follow-up / preference closure', () => {
  it('locks Phase 18 ownership boundaries without production drift', () => {
    const components = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/selectConversationReplyComponents.ts',
      ),
      'utf8',
    );
    expect(components).toContain('Phase 18B');
    expect(components).toContain(
      'const followUpQuestion = selectConversationFollowUpQuestion(state);',
    );
    expect(components).not.toMatch(
      /const followUpQuestion = messageInterpreted\s*\?/,
    );

    const selector = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
      ),
      'utf8',
    );
    expect(selector).toContain('Phase 18D');
    expect(selector).toMatch(
      /state\.activitiesRequested === true &&\s*!hasSpecificActivityInterest\(state\)/,
    );
    expect(selector).toContain('Phase 18F');
    expect(selector).toMatch(
      /state\.restaurantsRequested === true &&\s*state\.restaurantPreference === null/,
    );

    const preferenceExtractor = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/RestaurantPreferenceConversationStateExtractor.ts',
      ),
      'utf8',
    );
    expect(preferenceExtractor).toContain('Phase 18F');
    expect(preferenceExtractor).toMatch(
      /currentState\.restaurantsRequested !== true/,
    );

    const types = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/types.ts'),
      'utf8',
    );
    expect(types).toMatch(/restaurantPreference:\s*string \| null/);
  });

  it('1. unsupported input on an incomplete core trip asks the next required field', () => {
    const t = turn("I'm not sure yet", {
      destination: 'Cairns',
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(ORIGIN_Q);
    expect(t.reply).toContain(ORIGIN_Q);
    expect(t.reply).not.toContain(NEUTRAL);
    assertSingleQuestionInvariant(t.reply, 'incomplete unsupported');
  });

  it('2. unsupported input on a complete trip yields terminal neutral continuation', () => {
    const t = turn("I'm not sure yet", COMPLETE_CORE);
    expect(t.extracted).toEqual({});
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    assertSingleQuestionInvariant(t.reply, 'complete unsupported');
  });

  it('3. activities enabled with no specific activity asks the activities follow-up', () => {
    const t = turn('find activities', COMPLETE_CORE);
    expect(t.state.activitiesRequested).toBe(true);
    expect(t.components.followUpQuestion).toBe(ACTIVITIES_Q);
    expect(t.reply).toContain(ACTIVITIES_Q);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    assertSingleQuestionInvariant(t.reply, 'activities enabled only');
  });

  it('4. activities completed with one specific activity suppresses the activities follow-up', () => {
    const t = turn("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.state.hikingWalkingRequested).toBe(true);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
    expect(t.reply).toContain(NEUTRAL);
    assertSingleQuestionInvariant(t.reply, 'one specific activity');
  });

  it('5. activities completed with multiple specific activities stay suppressed', () => {
    const t = turn('kayaking and hiking', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.state.hikingWalkingRequested).toBe(true);
    expect(t.state.kayakingRequested).toBe(true);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
    expect(t.reply).toContain(NEUTRAL);
    assertSingleQuestionInvariant(t.reply, 'multiple specific activities');
  });

  it('6. restaurants enabled with no preference asks the dining follow-up', () => {
    const t = turn('find restaurants', COMPLETE_CORE);
    expect(t.state.restaurantsRequested).toBe(true);
    expect(t.state.restaurantPreference).toBeNull();
    expect(t.components.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(t.reply).toContain(RESTAURANTS_Q);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
    assertSingleQuestionInvariant(t.reply, 'restaurants enabled only');
  });

  it('7. restaurants completed with cuisine preference suppresses dining follow-up', () => {
    const t = turn('Italian', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    expect(t.state.restaurantPreference).toBe('Italian');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    expect(t.reply).toContain(NEUTRAL);
    assertSingleQuestionInvariant(t.reply, 'cuisine preference');
  });

  it('8. restaurants completed with seafood preference suppresses dining follow-up', () => {
    const t = turn('looking for seafood', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    expect(t.state.restaurantPreference).toBe('seafood');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    expect(t.reply).toContain(NEUTRAL);
    assertSingleQuestionInvariant(t.reply, 'seafood preference');
  });

  it('9. activities completed while restaurants remain incomplete asks dining', () => {
    const t = turn("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      restaurantsRequested: true,
    });
    expect(t.state.hikingWalkingRequested).toBe(true);
    expect(t.state.restaurantPreference).toBeNull();
    expect(t.components.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(t.reply).toContain(RESTAURANTS_Q);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
    assertSingleQuestionInvariant(t.reply, 'activities done, restaurants open');
  });

  it('10. restaurants completed while a higher-priority field remains incomplete asks that field', () => {
    const t = turn('seafood', {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      restaurantsRequested: true,
    });
    expect(t.state.restaurantPreference).toBe('seafood');
    expect(t.components.followUpQuestion).toBe(FOLLOW_UPS.returnDate);
    expect(t.reply).toContain(FOLLOW_UPS.returnDate);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    assertSingleQuestionInvariant(t.reply, 'restaurants done, return missing');
  });

  it('11. activities and restaurants both completed on a complete trip terminate neutrally', () => {
    const t = turn('looking for seafood', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
      restaurantsRequested: true,
    });
    expect(t.state.restaurantPreference).toBe('seafood');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    assertSingleQuestionInvariant(t.reply, 'both preferences complete');
  });

  it('12. repeated activity preference does not re-request activities', () => {
    const t = turn("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
    });
    expect(t.state.hikingWalkingRequested).toBe(true);
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
    expect(t.reply).toContain(NEUTRAL);
    assertSingleQuestionInvariant(t.reply, 'repeated activity');
  });

  it('13. repeated restaurant preference does not re-request dining', () => {
    const t = turn('seafood', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'seafood',
    });
    expect(t.extracted).toEqual({ restaurantPreference: 'seafood' });
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    expect(t.reply).toContain(NEUTRAL);
    assertSingleQuestionInvariant(t.reply, 'repeated restaurant preference');
  });

  it('14. unsupported input after both activities and restaurants are complete stays terminal', () => {
    const t = turn("I'm not sure", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
      restaurantsRequested: true,
      restaurantPreference: 'Italian',
    });
    expect(t.extracted).toEqual({});
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
    expect(t.reply).not.toContain(RESTAURANTS_Q);
    assertSingleQuestionInvariant(t.reply, 'unsupported after both complete');
  });

  it('proves the single-question invariant across the Phase 18 closure matrix', () => {
    const matrix: Array<{
      label: string;
      message: string;
      seed: Partial<ConversationCoreState>;
    }> = [
      {
        label: 'incomplete unsupported',
        message: "I'm not sure yet",
        seed: { destination: 'Cairns', flightsRequested: true },
      },
      {
        label: 'complete unsupported',
        message: 'Maybe',
        seed: COMPLETE_CORE,
      },
      {
        label: 'enable activities',
        message: 'find activities',
        seed: COMPLETE_CORE,
      },
      {
        label: 'hiking after activities',
        message: "I'm interested in hiking",
        seed: { ...COMPLETE_CORE, activitiesRequested: true },
      },
      {
        label: 'enable restaurants',
        message: 'find restaurants',
        seed: COMPLETE_CORE,
      },
      {
        label: 'Italian after restaurants',
        message: 'Italian',
        seed: { ...COMPLETE_CORE, restaurantsRequested: true },
      },
      {
        label: 'seafood after restaurants',
        message: 'looking for seafood',
        seed: { ...COMPLETE_CORE, restaurantsRequested: true },
      },
      {
        label: 'activities done restaurants open',
        message: "I'm interested in hiking",
        seed: {
          ...COMPLETE_CORE,
          activitiesRequested: true,
          restaurantsRequested: true,
        },
      },
      {
        label: 'both complete unsupported',
        message: 'Thanks',
        seed: {
          ...COMPLETE_CORE,
          activitiesRequested: true,
          hikingWalkingRequested: true,
          restaurantsRequested: true,
          restaurantPreference: 'seafood',
        },
      },
    ];

    for (const entry of matrix) {
      const t = turn(entry.message, entry.seed);
      expect(typeof t.components.followUpQuestion).toBe('string');
      assertSingleQuestionInvariant(t.reply, entry.label);
      if (t.components.followUpQuestion !== null) {
        expect(t.reply, entry.label).toContain(t.components.followUpQuestion);
      }
    }
  });
});
