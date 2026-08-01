import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 18E — restaurant follow-up completion audit.
 *
 * Pre-18F defect (historical evidence preserved in
 * docs/conversation-engine/phase18E-restaurant-follow-up-audit.md):
 * cuisine/seafood answers were not persisted and the dining follow-up
 * re-asked indefinitely. Phase 18F closes that defect via
 * restaurantPreference + RestaurantPreferenceConversationStateExtractor.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const RESTAURANTS_Q = FOLLOW_UPS.restaurants;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const ACTIVATED_DINING = `Now for dining. ${RESTAURANTS_Q}`;

/** Pre-18F selector contract — retained as regression documentation. */
const PRE_18F_SELECTOR_CONTRACT =
  'restaurantsRequested === true (no preference field consulted)';

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
  adultCount: 2,
} as const;

type RestaurantTrace = {
  message: string;
  extractedPatch: ConversationStateUpdate;
  final: ConversationCoreState;
  newlyEnabledRequestFlags: readonly string[];
  updated: readonly string[];
  messageInterpreted: boolean;
  acknowledgement: string | null;
  acknowledgementEvent: unknown;
  followUpQuestion: string | null;
  continuation: string | null;
  assembledPlanFollowUp: string | null;
  exactFinalReply: string;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-18e',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function trace(
  message: string,
  seed: Partial<ConversationCoreState> = {},
): RestaurantTrace {
  const previous = createState(seed);
  const extractedPatch = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-18e',
    assistantEntryId: 'assistant-18e',
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
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return {
    message,
    extractedPatch,
    final: result.state,
    newlyEnabledRequestFlags: classification.newlyEnabledRequestFlags,
    updated: classification.updated,
    messageInterpreted: classification.hasInterpretedChange,
    acknowledgement: components.acknowledgement,
    acknowledgementEvent: components.acknowledgementEvent,
    followUpQuestion: components.followUpQuestion,
    continuation: components.continuationPrompt,
    assembledPlanFollowUp: plan.followUpQuestion,
    exactFinalReply: result.reply,
  };
}

function journey(
  messages: readonly string[],
  seed: Partial<ConversationCoreState> = COMPLETE_CORE,
): RestaurantTrace[] {
  let state = createState(seed);
  const rows: RestaurantTrace[] = [];
  for (const message of messages) {
    const previous = state;
    const extractedPatch = COMPOSITE.extract({
      message,
      currentState: previous,
    }).stateUpdate;
    const result = processConversationTurn({
      message,
      state: previous,
      userEntryId: 'user-18e',
      assistantEntryId: 'assistant-18e',
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
    const plan = createConversationReplyPlan({
      state: result.state,
      classification,
    });
    rows.push({
      message,
      extractedPatch,
      final: result.state,
      newlyEnabledRequestFlags: classification.newlyEnabledRequestFlags,
      updated: classification.updated,
      messageInterpreted: classification.hasInterpretedChange,
      acknowledgement: components.acknowledgement,
      acknowledgementEvent: components.acknowledgementEvent,
      followUpQuestion: components.followUpQuestion,
      continuation: components.continuationPrompt,
      assembledPlanFollowUp: plan.followUpQuestion,
      exactFinalReply: result.reply,
    });
    state = result.state;
  }
  return rows;
}

describe('Phase 18E — restaurant follow-up completion audit', () => {
  it('locks the restaurants follow-up applies contract and Phase 18F preference field', () => {
    const followUpSource = readFileSync(
      resolve(CORE_SRC, 'selectConversationFollowUpQuestion.ts'),
      'utf8',
    );
    expect(PRE_18F_SELECTOR_CONTRACT).toContain('restaurantsRequested === true');
    expect(followUpSource).toContain('Phase 18F');
    expect(followUpSource).toMatch(
      /state\.restaurantsRequested === true &&\s*state\.restaurantPreference === null/,
    );
    expect(followUpSource).not.toMatch(/cuisinePreference|diningPreference|seafoodRequested/);

    const types = readFileSync(resolve(CORE_SRC, 'types.ts'), 'utf8');
    expect(types).toContain('restaurantsRequested');
    expect(types).toMatch(/restaurantPreference:\s*string \| null/);
    expect(types).not.toMatch(/cuisinePreference|diningPreference|seafoodRequested/);

    const extractor = readFileSync(
      resolve(CORE_SRC, 'RestaurantsRequestedConversationStateExtractor.ts'),
      'utf8',
    );
    expect(extractor).toContain('restaurantsRequested: true');
    expect(extractor).not.toMatch(
      /(?:cuisinePreference|diningPreference|seafoodRequested|restaurantPreference)\s*:/,
    );

    const preferenceExtractor = readFileSync(
      resolve(CORE_SRC, 'RestaurantPreferenceConversationStateExtractor.ts'),
      'utf8',
    );
    expect(preferenceExtractor).toContain('restaurantPreference');
    expect(preferenceExtractor).toContain('input.currentState.restaurantsRequested');
  });

  it('characterizes restaurants requested only', () => {
    const t = trace('find restaurants', COMPLETE_CORE);
    expect(t.extractedPatch).toEqual({ restaurantsRequested: true });
    expect(t.final.restaurantsRequested).toBe(true);
    expect(t.newlyEnabledRequestFlags).toEqual(['restaurantsRequested']);
    expect(t.messageInterpreted).toBe(true);
    expect(t.acknowledgementEvent).toEqual({
      kind: 'capability-enabled',
      capabilities: ['restaurants'],
    });
    expect(t.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(t.continuation).toBeNull();
    expect(t.exactFinalReply).toBe(
      `Great, I've added restaurants to your trip. ${RESTAURANTS_Q}`,
    );
  });

  it('characterizes cuisine preference answers as persisted under restaurantsRequested (Phase 18F)', () => {
    const seed = { ...COMPLETE_CORE, restaurantsRequested: true as const };
    const cuisineMessages = [
      { message: 'Italian', value: 'Italian' },
      { message: 'I want Italian food', value: 'Italian' },
      { message: 'Japanese cuisine', value: 'Japanese' },
      { message: 'we like Thai', value: 'Thai' },
      { message: 'fine dining', value: 'fine dining' },
      { message: 'casual dining', value: 'casual dining' },
      { message: 'vegetarian', value: 'vegetarian food' },
    ];
    for (const entry of cuisineMessages) {
      const t = trace(entry.message, seed);
      expect(t.extractedPatch, entry.message).toEqual({
        restaurantPreference: entry.value,
      });
      expect(t.final.restaurantsRequested, entry.message).toBe(true);
      expect(t.final.restaurantPreference, entry.message).toBe(entry.value);
      expect(t.messageInterpreted, entry.message).toBe(true);
      expect(t.followUpQuestion, entry.message).toBe(NEUTRAL);
      expect(t.exactFinalReply, entry.message).not.toContain(RESTAURANTS_Q);
    }
  });

  it('characterizes seafood preference as persisted and suppressing dining follow-up (Phase 18F)', () => {
    const seed = { ...COMPLETE_CORE, restaurantsRequested: true as const };
    for (const message of ['looking for seafood', 'seafood']) {
      const t = trace(message, seed);
      expect(t.extractedPatch, message).toEqual({
        restaurantPreference: 'seafood',
      });
      expect(t.final.restaurantsRequested, message).toBe(true);
      expect(t.final.restaurantPreference, message).toBe('seafood');
      expect(t.messageInterpreted, message).toBe(true);
      expect(t.followUpQuestion, message).toBe(NEUTRAL);
      expect(t.exactFinalReply, message).not.toContain(RESTAURANTS_Q);
      // Phase 19E — dedicated preference acknowledgement includes the value.
      expect(t.exactFinalReply, message).toContain('Great — seafood.');
    }
  });

  it('characterizes repeated cuisine and seafood as no longer re-asking dining (Phase 18F)', () => {
    const seed = { ...COMPLETE_CORE, restaurantsRequested: true as const };
    const cuisineRepeat = journey(['Italian', 'Italian'], seed);
    expect(cuisineRepeat[0]!.followUpQuestion).toBe(NEUTRAL);
    expect(cuisineRepeat[0]!.final.restaurantPreference).toBe('Italian');
    expect(cuisineRepeat[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(cuisineRepeat[1]!.messageInterpreted).toBe(false);
    expect(cuisineRepeat[1]!.exactFinalReply).not.toContain(RESTAURANTS_Q);

    const seafoodRepeat = journey(
      ['looking for seafood', 'looking for seafood'],
      seed,
    );
    expect(seafoodRepeat[0]!.followUpQuestion).toBe(NEUTRAL);
    expect(seafoodRepeat[0]!.final.restaurantPreference).toBe('seafood');
    expect(seafoodRepeat[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(seafoodRepeat[1]!.exactFinalReply).not.toContain(RESTAURANTS_Q);
  });

  it('preserves neutral follow-up for unsupported input after preference is captured (Phase 18F)', () => {
    const rows = journey(
      ['looking for seafood', "I'm not sure"],
      { ...COMPLETE_CORE, restaurantsRequested: true },
    );
    expect(rows[0]!.followUpQuestion).toBe(NEUTRAL);
    expect(rows[0]!.final.restaurantPreference).toBe('seafood');
    expect(rows[1]!.messageInterpreted).toBe(false);
    expect(rows[1]!.acknowledgement).toBeNull();
    expect(rows[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(rows[1]!.exactFinalReply).not.toContain(RESTAURANTS_Q);
  });

  it('characterizes restaurants enable then seafood journey (Phase 18F)', () => {
    const rows = journey(['find restaurants', 'looking for seafood']);
    expect(rows[0]!.extractedPatch).toEqual({ restaurantsRequested: true });
    expect(rows[0]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(rows[1]!.extractedPatch).toEqual({ restaurantPreference: 'seafood' });
    expect(rows[1]!.final.restaurantsRequested).toBe(true);
    expect(rows[1]!.final.restaurantPreference).toBe('seafood');
    expect(rows[1]!.messageInterpreted).toBe(true);
    expect(rows[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(rows[1]!.exactFinalReply).not.toContain(RESTAURANTS_Q);
  });

  it('characterizes activities + restaurants interaction after Phase 18D', () => {
    const afterHiking = trace("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      restaurantsRequested: true,
    });
    expect(afterHiking.final.hikingWalkingRequested).toBe(true);
    expect(afterHiking.followUpQuestion).toBe(RESTAURANTS_Q);

    const enableRestaurantsAfterHiking = journey(
      ["I'm interested in hiking", 'find restaurants'],
      { ...COMPLETE_CORE, activitiesRequested: true },
    );
    expect(enableRestaurantsAfterHiking[0]!.followUpQuestion).toBe(NEUTRAL);
    expect(enableRestaurantsAfterHiking[1]!.followUpQuestion).toBe(
      RESTAURANTS_Q,
    );

    const wineries = trace('wineries', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    expect(wineries.extractedPatch).toEqual({
      wineriesFoodTrailsRequested: true,
    });
    expect(wineries.final.wineriesFoodTrailsRequested).toBe(true);
    expect(wineries.followUpQuestion).toBe(RESTAURANTS_Q);
  });

  it('proves selector evidence: restaurantsRequested with null preference selects dining follow-up', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({ ...COMPLETE_CORE, restaurantsRequested: true }),
      ),
    ).toBe(RESTAURANTS_Q);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          restaurantsRequested: true,
          restaurantPreference: 'seafood',
        }),
      ),
    ).toBe(NEUTRAL);

    expect(
      selectConversationFollowUpQuestion(
        createState({ ...COMPLETE_CORE, restaurantsRequested: false }),
      ),
    ).toBe(NEUTRAL);

    expect(
      selectConversationFollowUpQuestion(
        createState({ ...COMPLETE_CORE, restaurantsRequested: null }),
      ),
    ).toBe(NEUTRAL);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          restaurantsRequested: true,
          wineriesFoodTrailsRequested: true,
        }),
      ),
    ).toBe(RESTAURANTS_Q);
  });
});
