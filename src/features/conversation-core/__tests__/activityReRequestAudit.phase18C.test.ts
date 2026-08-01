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
 * Phase 18C — activity re-request selection audit.
 *
 * Preserves historical evidence of the pre-18D defect: activities follow-up
 * applied whenever `activitiesRequested === true`, even after specific activity
 * capability flags were set.
 *
 * Post-18D (Phase 18D fix in selectConversationFollowUpQuestion): activities
 * follow-up applies only when `activitiesRequested === true &&
 * !hasSpecificActivityInterest(state)`. Expectations below reflect post-18D
 * completion behaviour while documenting the earlier failure mode.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACTIVITIES_Q = FOLLOW_UPS.activities;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const BRIDGE =
  "Is there anything else you'd like me to consider? What else should I know about your trip?";
const CAPABILITY_BRIDGE =
  'Tell me anything else that matters for this trip. What else should I know about your trip?';

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
  adultCount: 2,
} as const;

type ActivityTrace = {
  message: string;
  extractedPatch: ConversationStateUpdate;
  final: ConversationCoreState;
  newlyEnabledRequestFlags: readonly string[];
  newlyDisabledRequestFlags: readonly string[];
  updated: readonly string[];
  newlyPopulated: readonly string[];
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
      conversationId: 'conversation-18c',
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
): ActivityTrace {
  const previous = createState(seed);
  const extractedPatch = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-18c',
    assistantEntryId: 'assistant-18c',
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
    newlyDisabledRequestFlags: classification.newlyDisabledRequestFlags,
    updated: classification.updated,
    newlyPopulated: classification.newlyPopulated,
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
): ActivityTrace[] {
  let state = createState(seed);
  const rows: ActivityTrace[] = [];
  for (const message of messages) {
    const previous = state;
    const extractedPatch = COMPOSITE.extract({
      message,
      currentState: previous,
    }).stateUpdate;
    const result = processConversationTurn({
      message,
      state: previous,
      userEntryId: 'user-18c',
      assistantEntryId: 'assistant-18c',
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
      newlyDisabledRequestFlags: classification.newlyDisabledRequestFlags,
      updated: classification.updated,
      newlyPopulated: classification.newlyPopulated,
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

describe('Phase 18C — activity re-request selection audit', () => {
  it('documents pre-18D defect contract and locks post-18D completion predicate', () => {
    // Pre-18D defect: activities follow-up applied on activitiesRequested alone.
    const pre18DContract =
      'activitiesRequested === true (specific activity flags not consulted)';

    const source = readFileSync(
      resolve(CORE_SRC, 'selectConversationFollowUpQuestion.ts'),
      'utf8',
    );
    expect(pre18DContract).toContain('activitiesRequested === true');
    expect(source).toMatch(
      /Dining still has no dedicated preference field/,
    );
    expect(source).toContain('Phase 18D');
    expect(source).toContain('SPECIFIC_ACTIVITY_INTEREST_FLAGS');
    expect(source).toContain('hasSpecificActivityInterest');
    expect(source).toMatch(
      /state\.activitiesRequested === true &&\s*!hasSpecificActivityInterest\(state\)/,
    );
    expect(source).toContain('CONVERSATION_REPLY_CATALOGUE.followUps.activities');
    expect(source).not.toMatch(/activityPreference/);

    const types = readFileSync(resolve(CORE_SRC, 'types.ts'), 'utf8');
    expect(types).toContain('activitiesRequested');
    expect(types).toContain('hikingWalkingRequested');
    expect(types).not.toMatch(/activityPreference/);
  });

  it('characterizes supported activity phrases under activitiesRequested=true', () => {
    const seed = { ...COMPLETE_CORE, activitiesRequested: true as const };
    const cases: Array<{
      message: string;
      expectedPatch: ConversationStateUpdate;
      expectedFlag: keyof ConversationCoreState;
    }> = [
      {
        message: "I'm interested in hiking",
        expectedPatch: { hikingWalkingRequested: true },
        expectedFlag: 'hikingWalkingRequested',
      },
      {
        message: 'We want to go hiking',
        expectedPatch: { hikingWalkingRequested: true },
        expectedFlag: 'hikingWalkingRequested',
      },
      {
        message: 'Hiking',
        expectedPatch: { hikingWalkingRequested: true },
        expectedFlag: 'hikingWalkingRequested',
      },
      {
        message: 'Walking and hiking',
        expectedPatch: { hikingWalkingRequested: true },
        expectedFlag: 'hikingWalkingRequested',
      },
      {
        message: 'Bushwalking',
        expectedPatch: { hikingWalkingRequested: true },
        expectedFlag: 'hikingWalkingRequested',
      },
      {
        message: 'Nature walks',
        expectedPatch: { hikingWalkingRequested: true },
        expectedFlag: 'hikingWalkingRequested',
      },
      {
        message: 'Kayaking',
        expectedPatch: { kayakingRequested: true },
        expectedFlag: 'kayakingRequested',
      },
      {
        message: 'Snorkelling',
        expectedPatch: { divingSnorkellingRequested: true },
        expectedFlag: 'divingSnorkellingRequested',
      },
      {
        message: 'Diving',
        expectedPatch: { divingSnorkellingRequested: true },
        expectedFlag: 'divingSnorkellingRequested',
      },
      {
        message: 'Fishing',
        expectedPatch: { fishingRequested: true },
        expectedFlag: 'fishingRequested',
      },
      {
        message: 'Wildlife experiences',
        expectedPatch: {
          activitiesRequested: true,
          wildlifeRequested: true,
        },
        expectedFlag: 'wildlifeRequested',
      },
      {
        message: 'National parks',
        expectedPatch: { nationalParksRequested: true },
        expectedFlag: 'nationalParksRequested',
      },
      {
        message: 'Scenic drives',
        expectedPatch: { scenicDrivesRequested: true },
        expectedFlag: 'scenicDrivesRequested',
      },
      {
        message: 'Beaches',
        expectedPatch: { beachesRequested: true },
        expectedFlag: 'beachesRequested',
      },
    ];

    for (const entry of cases) {
      const t = trace(entry.message, seed);
      expect(t.extractedPatch, entry.message).toEqual(entry.expectedPatch);
      expect(t.final[entry.expectedFlag], entry.message).toBe(true);
      expect(t.final.activitiesRequested, entry.message).toBe(true);
      expect(t.followUpQuestion, entry.message).toBe(NEUTRAL);
      expect(t.continuation, entry.message).toBeNull();
      expect(t.assembledPlanFollowUp, entry.message).toBe(NEUTRAL);
      expect(t.exactFinalReply, entry.message).not.toContain(ACTIVITIES_Q);
      expect(t.exactFinalReply, entry.message).toContain(CAPABILITY_BRIDGE);
    }
  });

  it('characterizes unsupported or non-persisting broad phrases under activitiesRequested=true', () => {
    const seed = { ...COMPLETE_CORE, activitiesRequested: true as const };
    for (const message of ['Shopping', 'Nightlife', 'Wellness activities']) {
      const t = trace(message, seed);
      expect(t.final.shoppingRequested, message).toBeNull();
      expect(t.final.nightlifeRequested, message).toBeNull();
      expect(t.final.wellnessRequested, message).toBeNull();
      expect(t.final.activitiesRequested, message).toBe(true);
      expect(t.messageInterpreted, message).toBe(false);
      expect(t.acknowledgement, message).toBeNull();
      expect(t.followUpQuestion, message).toBe(ACTIVITIES_Q);
      expect(t.exactFinalReply, message).toBe(
        `Let's look at activities. ${ACTIVITIES_Q}`,
      );
    }
  });

  it('proves hiking is extracted and persisted and post-18D satisfies activities follow-up', () => {
    const t = trace("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.extractedPatch).toEqual({ hikingWalkingRequested: true });
    expect(t.final.hikingWalkingRequested).toBe(true);
    expect(t.final.activitiesRequested).toBe(true);
    expect(t.newlyEnabledRequestFlags).toEqual(['hikingWalkingRequested']);
    expect(t.updated).toEqual([]);
    expect(t.messageInterpreted).toBe(true);
    expect(t.acknowledgementEvent).toEqual({
      kind: 'capability-enabled',
      capabilities: ['hiking and walking'],
    });
    expect(selectConversationFollowUpQuestion(t.final)).toBe(NEUTRAL);
    expect(t.followUpQuestion).toBe(NEUTRAL);
    expect(t.continuation).toBeNull();
    expect(t.exactFinalReply).toBe(
      `Great, I've added hiking and walking to your trip. ${CAPABILITY_BRIDGE}`,
    );
  });

  it('characterizes required journey scenarios', () => {
    // activities enabled, no preference / specific capability
    const noDetail = trace('hello', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(noDetail.followUpQuestion).toBe(ACTIVITIES_Q);
    expect(noDetail.messageInterpreted).toBe(false);

    // activities enabled and hiking already true — repeated input unchanged
    const already = trace("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
    });
    expect(already.extractedPatch).toEqual({ hikingWalkingRequested: true });
    expect(already.newlyEnabledRequestFlags).toEqual([]);
    expect(already.messageInterpreted).toBe(false);
    expect(already.acknowledgement).toBeNull();
    expect(already.followUpQuestion).toBe(NEUTRAL);

    // activities disabled — hiking enables specific flag; no activities question
    const disabled = trace("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: false,
    });
    expect(disabled.final.hikingWalkingRequested).toBe(true);
    expect(disabled.final.activitiesRequested).toBe(false);
    expect(disabled.followUpQuestion).toBe(NEUTRAL);

    // trip otherwise incomplete — core progression wins over activities
    const incomplete = trace("I'm interested in hiking", {
      destination: 'Cairns',
      activitiesRequested: true,
    });
    expect(incomplete.final.hikingWalkingRequested).toBe(true);
    expect(incomplete.followUpQuestion).toBe(FOLLOW_UPS.origin);

    // restaurants also enabled — post-18D activities satisfied; restaurants next
    const both = trace("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      restaurantsRequested: true,
    });
    expect(both.followUpQuestion).toBe(FOLLOW_UPS.restaurants);

    // multiple capabilities in one message while activities enabled
    const multi = trace('I want hiking and kayaking', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(multi.extractedPatch).toEqual({
      kayakingRequested: true,
      hikingWalkingRequested: true,
    });
    expect(multi.final.hikingWalkingRequested).toBe(true);
    expect(multi.final.kayakingRequested).toBe(true);
    expect(multi.followUpQuestion).toBe(NEUTRAL);
  });

  it('captures the multi-turn journey matrix with exact replies', () => {
    const j1 = journey(['I need activities', "I'm interested in hiking"]);
    expect(j1[0]!.extractedPatch).toEqual({ activitiesRequested: true });
    expect(j1[0]!.followUpQuestion).toBe(ACTIVITIES_Q);
    expect(j1[0]!.exactFinalReply).toBe(
      `Great, I've added activities to your trip. ${ACTIVITIES_Q}`,
    );
    expect(j1[1]!.extractedPatch).toEqual({ hikingWalkingRequested: true });
    expect(j1[1]!.final.activitiesRequested).toBe(true);
    expect(j1[1]!.final.hikingWalkingRequested).toBe(true);
    expect(j1[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(j1[1]!.exactFinalReply).toBe(
      `Great, I've added hiking and walking to your trip. ${CAPABILITY_BRIDGE}`,
    );

    // Hiking alone does not enable activitiesRequested → no activities question.
    const j2 = journey(['I want hiking', "I'm not sure"]);
    expect(j2[0]!.final.activitiesRequested).toBeNull();
    expect(j2[0]!.final.hikingWalkingRequested).toBe(true);
    expect(j2[0]!.followUpQuestion).toBe(NEUTRAL);
    expect(j2[1]!.messageInterpreted).toBe(false);
    expect(j2[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(j2[1]!.exactFinalReply).toBe(
      `There's just one more thing I'd like to know. ${NEUTRAL}`,
    );

    const j3 = journey(['I want hiking and kayaking']);
    expect(j3[0]!.extractedPatch).toEqual({
      kayakingRequested: true,
      hikingWalkingRequested: true,
    });
    expect(j3[0]!.final.activitiesRequested).toBeNull();
    expect(j3[0]!.followUpQuestion).toBe(NEUTRAL);

    const j4 = journey(['I want activities', 'Hiking', 'I also like kayaking']);
    expect(j4[0]!.followUpQuestion).toBe(ACTIVITIES_Q);
    expect(j4[1]!.final.hikingWalkingRequested).toBe(true);
    expect(j4[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(j4[2]!.final.kayakingRequested).toBe(true);
    expect(j4[2]!.final.hikingWalkingRequested).toBe(true);
    expect(j4[2]!.followUpQuestion).toBe(NEUTRAL);
    expect(j4[2]!.exactFinalReply).toBe(
      `Great, I've added kayaking to your trip. ${CAPABILITY_BRIDGE}`,
    );

    const j5 = journey(['I want hiking', "I don't know"]);
    expect(j5[0]!.followUpQuestion).toBe(NEUTRAL);
    expect(j5[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(j5[1]!.acknowledgement).toBeNull();
  });

  it('shows Phase 18B unsupported-after-hiking behaviour with and without activitiesRequested', () => {
    // Without activitiesRequested: hiking alone → terminal neutral; unsupported keeps neutral.
    const without = journey(["I'm interested in hiking", "I don't know"]);
    expect(without[0]!.final.hikingWalkingRequested).toBe(true);
    expect(without[0]!.final.activitiesRequested).toBeNull();
    expect(without[0]!.followUpQuestion).toBe(NEUTRAL);
    expect(without[1]!.followUpQuestion).toBe(NEUTRAL);

    // With activitiesRequested: post-18D suppresses activities after hiking;
    // unsupported after Phase 18B activates terminal neutral (not activities re-ask).
    const withActivities = journey(
      ["I'm interested in hiking", "I don't know"],
      { ...COMPLETE_CORE, activitiesRequested: true },
    );
    expect(withActivities[0]!.final.hikingWalkingRequested).toBe(true);
    expect(withActivities[0]!.followUpQuestion).toBe(NEUTRAL);
    expect(withActivities[1]!.messageInterpreted).toBe(false);
    expect(withActivities[1]!.acknowledgement).toBeNull();
    expect(withActivities[1]!.followUpQuestion).toBe(NEUTRAL);
    expect(withActivities[1]!.exactFinalReply).toBe(
      `There's just one more thing I'd like to know. ${NEUTRAL}`,
    );
  });

  it('compares activities paths against restaurants/seafood architecture', () => {
    const enabledOnly = trace('hello', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(enabledOnly.followUpQuestion).toBe(ACTIVITIES_Q);

    const withCapability = trace('Kayaking', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(withCapability.final.kayakingRequested).toBe(true);
    expect(withCapability.followUpQuestion).toBe(NEUTRAL);

    const seafood = trace('looking for seafood', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    expect(seafood.extractedPatch).toEqual({});
    expect(seafood.final.restaurantsRequested).toBe(true);
    expect(seafood.messageInterpreted).toBe(false);
    expect(seafood.followUpQuestion).toBe(FOLLOW_UPS.restaurants);
  });

  it('shows post-18D selector evidence: specific activity flags suppress activities question', () => {
    const withHiking = createState({
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
      kayakingRequested: true,
      divingSnorkellingRequested: true,
    });
    expect(selectConversationFollowUpQuestion(withHiking)).toBe(NEUTRAL);

    const withoutActivitiesFlag = createState({
      ...COMPLETE_CORE,
      activitiesRequested: null,
      hikingWalkingRequested: true,
    });
    expect(selectConversationFollowUpQuestion(withoutActivitiesFlag)).toBe(
      NEUTRAL,
    );

    const activitiesFalse = createState({
      ...COMPLETE_CORE,
      activitiesRequested: false,
      hikingWalkingRequested: true,
    });
    expect(selectConversationFollowUpQuestion(activitiesFalse)).toBe(NEUTRAL);
  });
});
