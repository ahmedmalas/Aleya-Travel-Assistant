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
 * Characterizes current behaviour, including the defective re-ask of the
 * dining preference question after cuisine/seafood answers that are not
 * persisted. Production code unchanged.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const RESTAURANTS_Q = FOLLOW_UPS.restaurants;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const ACTIVATED_DINING = `Now for dining. ${RESTAURANTS_Q}`;

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
  it('locks the restaurants follow-up applies contract and absent preference fields', () => {
    const followUpSource = readFileSync(
      resolve(CORE_SRC, 'selectConversationFollowUpQuestion.ts'),
      'utf8',
    );
    expect(followUpSource).toContain(
      'Dining still has no dedicated preference field',
    );
    expect(followUpSource).toMatch(
      /applies:\s*\(state: ConversationCoreState\) =>\s*state\.restaurantsRequested === true/,
    );
    expect(followUpSource).not.toMatch(/cuisinePreference|diningPreference|seafoodRequested/);

    const types = readFileSync(resolve(CORE_SRC, 'types.ts'), 'utf8');
    expect(types).toContain('restaurantsRequested');
    expect(types).not.toMatch(/cuisinePreference|diningPreference|seafoodRequested|restaurantPreference/);

    const extractor = readFileSync(
      resolve(CORE_SRC, 'RestaurantsRequestedConversationStateExtractor.ts'),
      'utf8',
    );
    expect(extractor).toContain('restaurantsRequested: true');
    // Extractor owns restaurantsRequested only — no preference patch keys.
    expect(extractor).not.toMatch(
      /(?:cuisinePreference|diningPreference|seafoodRequested)\s*:/,
    );
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

  it('characterizes cuisine preference answers as unpersisted under restaurantsRequested', () => {
    const seed = { ...COMPLETE_CORE, restaurantsRequested: true as const };
    const cuisineMessages = [
      'Italian',
      'I want Italian food',
      'Japanese cuisine',
      'we like Thai',
      'fine dining',
      'casual dining',
      'vegetarian',
    ];
    for (const message of cuisineMessages) {
      const t = trace(message, seed);
      expect(t.extractedPatch, message).toEqual({});
      expect(t.final.restaurantsRequested, message).toBe(true);
      expect(t.messageInterpreted, message).toBe(false);
      expect(t.acknowledgement, message).toBeNull();
      expect(t.followUpQuestion, message).toBe(RESTAURANTS_Q);
      expect(t.exactFinalReply, message).toBe(ACTIVATED_DINING);
      expect(t.exactFinalReply, message).not.toMatch(/italian|thai|japanese|vegetarian|fine dining/i);
    }
  });

  it('characterizes seafood preference as unpersisted and non-suppressing', () => {
    const seed = { ...COMPLETE_CORE, restaurantsRequested: true as const };
    for (const message of ['looking for seafood', 'seafood']) {
      const t = trace(message, seed);
      expect(t.extractedPatch, message).toEqual({});
      expect(t.final.restaurantsRequested, message).toBe(true);
      expect(t.messageInterpreted, message).toBe(false);
      expect(t.acknowledgement, message).toBeNull();
      expect(t.followUpQuestion, message).toBe(RESTAURANTS_Q);
      expect(t.exactFinalReply, message).toBe(ACTIVATED_DINING);
      expect(t.exactFinalReply, message).not.toMatch(/seafood/i);
    }
  });

  it('characterizes repeated cuisine and seafood as still re-asking dining', () => {
    const seed = { ...COMPLETE_CORE, restaurantsRequested: true as const };
    const cuisineRepeat = journey(['Italian', 'Italian'], seed);
    expect(cuisineRepeat[0]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(cuisineRepeat[1]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(cuisineRepeat[1]!.messageInterpreted).toBe(false);
    expect(cuisineRepeat[1]!.exactFinalReply).toBe(ACTIVATED_DINING);

    const seafoodRepeat = journey(
      ['looking for seafood', 'looking for seafood'],
      seed,
    );
    expect(seafoodRepeat[0]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(seafoodRepeat[1]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(seafoodRepeat[1]!.exactFinalReply).toBe(ACTIVATED_DINING);
  });

  it('preserves restaurants follow-up for unsupported input after preference attempts', () => {
    const rows = journey(
      ['looking for seafood', "I'm not sure"],
      { ...COMPLETE_CORE, restaurantsRequested: true },
    );
    expect(rows[0]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(rows[1]!.messageInterpreted).toBe(false);
    expect(rows[1]!.acknowledgement).toBeNull();
    expect(rows[1]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(rows[1]!.exactFinalReply).toBe(ACTIVATED_DINING);
  });

  it('characterizes restaurants enable then seafood journey', () => {
    const rows = journey(['find restaurants', 'looking for seafood']);
    expect(rows[0]!.extractedPatch).toEqual({ restaurantsRequested: true });
    expect(rows[0]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(rows[1]!.extractedPatch).toEqual({});
    expect(rows[1]!.final.restaurantsRequested).toBe(true);
    expect(rows[1]!.messageInterpreted).toBe(false);
    expect(rows[1]!.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(rows[1]!.exactFinalReply).toBe(ACTIVATED_DINING);
  });

  it('characterizes activities + restaurants interaction after Phase 18D', () => {
    // Activities satisfied by hiking; restaurants still ask dining preference.
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

    // Related food capability does not complete restaurants follow-up.
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

  it('proves selector evidence: only restaurantsRequested selects dining follow-up', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({ ...COMPLETE_CORE, restaurantsRequested: true }),
      ),
    ).toBe(RESTAURANTS_Q);

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

    // No preference field exists to suppress; wineries flag is irrelevant.
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
