import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 18D — activities follow-up completes once any specific activity
 * interest capability is true. Production change is limited to
 * selectConversationFollowUpQuestion.
 */

const ROOT = process.cwd();
const FOLLOW_UP_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
);
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACTIVITIES_Q = FOLLOW_UPS.activities;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const BRIDGE =
  "Is there anything else you'd like me to consider? What else should I know about your trip?";
const CAPABILITY_BRIDGE =
  'Tell me anything else that matters for this trip. What else should I know about your trip?';

/** Canonical specific activity-interest flags from the Phase 18D predicate. */
const SPECIFIC_ACTIVITY_FLAGS = [
  'nearbyDiscoveryRequested',
  'accessibleTravelRequested',
  'beachesRequested',
  'campingRequested',
  'kayakingRequested',
  'fourWheelDriveRequested',
  'scenicDrivesRequested',
  'attractionsRequested',
  'snowActivitiesRequested',
  'hikingWalkingRequested',
  'fishingRequested',
  'divingSnorkellingRequested',
  'wineriesFoodTrailsRequested',
  'eventsFestivalsRequested',
  'wildlifeRequested',
  'nationalParksRequested',
  'toursRequested',
  'eventsRequested',
  'nightlifeRequested',
  'shoppingRequested',
  'wellnessRequested',
  'familyActivitiesRequested',
] as const satisfies ReadonlyArray<keyof ConversationCoreState>;

const UNRELATED_SERVICE_FLAGS = [
  'flightsRequested',
  'accommodationRequested',
  'carHireRequested',
  'restaurantsRequested',
] as const satisfies ReadonlyArray<keyof ConversationCoreState>;

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
      conversationId: 'conversation-18d',
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
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-18d',
    assistantEntryId: 'assistant-18d',
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
    previous,
    state: result.state,
    classification,
    components,
    plan,
    reply: result.reply,
  };
}

function journey(
  messages: readonly string[],
  seed: Partial<ConversationCoreState> = COMPLETE_CORE,
) {
  let state = createState(seed);
  const rows = [];
  for (const message of messages) {
    const result = turn(message, state);
    rows.push(result);
    state = result.state;
  }
  return rows;
}

describe('Phase 18D — complete activities follow-up from specific interests', () => {
  it('locks the activities completion predicate and canonical flag set', () => {
    const source = readFileSync(FOLLOW_UP_SOURCE, 'utf8');
    expect(source).toContain('Phase 18D');
    expect(source).toContain('SPECIFIC_ACTIVITY_INTEREST_FLAGS');
    expect(source).toContain('hasSpecificActivityInterest');
    expect(source).toMatch(
      /state\.activitiesRequested === true &&\s*!hasSpecificActivityInterest\(state\)/,
    );
    for (const flag of SPECIFIC_ACTIVITY_FLAGS) {
      expect(source, flag).toContain(`'${flag}'`);
    }
    expect(source).not.toContain("'flightsRequested'");
    expect(source).not.toContain("'accommodationRequested'");
    expect(source).not.toContain("'carHireRequested'");
    expect(source).not.toContain("'restaurantsRequested'");
    expect(source).not.toContain("'activitiesRequested'");
  });

  it('keeps the activities question when activities are enabled with no specifics', () => {
    const state = createState({
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(ACTIVITIES_Q);
    const components = selectConversationReplyComponents({
      state,
      classification: classifyConversationStateChange(state, state),
    });
    expect(components.followUpQuestion).toBe(ACTIVITIES_Q);
    expect(components.continuationPrompt).toBeNull();
  });

  it('suppresses activities for each canonical specific activity flag', () => {
    for (const flag of SPECIFIC_ACTIVITY_FLAGS) {
      const state = createState({
        ...COMPLETE_CORE,
        activitiesRequested: true,
        [flag]: true,
      });
      expect(
        selectConversationFollowUpQuestion(state),
        flag,
      ).not.toBe(ACTIVITIES_Q);
      expect(selectConversationFollowUpQuestion(state), flag).toBe(NEUTRAL);
    }
  });

  it('suppresses activities for one and multiple specific flags', () => {
    const one = createState({
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
    });
    expect(selectConversationFollowUpQuestion(one)).toBe(NEUTRAL);

    const multi = createState({
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
      kayakingRequested: true,
    });
    expect(selectConversationFollowUpQuestion(multi)).toBe(NEUTRAL);
  });

  it('does not select activities when activitiesRequested is false', () => {
    const state = createState({
      ...COMPLETE_CORE,
      activitiesRequested: false,
      hikingWalkingRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(NEUTRAL);
  });

  it('does not let unrelated service flags satisfy activities', () => {
    for (const flag of UNRELATED_SERVICE_FLAGS) {
      const state = createState({
        ...COMPLETE_CORE,
        activitiesRequested: true,
        [flag]: true,
      });
      expect(selectConversationFollowUpQuestion(state), flag).toBe(
        ACTIVITIES_Q,
      );
    }
  });

  it('preserves next-priority follow-ups after activities are satisfied', () => {
    const restaurantsNext = createState({
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
      restaurantsRequested: true,
    });
    expect(selectConversationFollowUpQuestion(restaurantsNext)).toBe(
      FOLLOW_UPS.restaurants,
    );

    const returnMissing = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      activitiesRequested: true,
      hikingWalkingRequested: true,
    });
    expect(selectConversationFollowUpQuestion(returnMissing)).toBe(
      FOLLOW_UPS.returnDate,
    );
  });

  it('preserves capability acknowledgement and stops re-asking activities', () => {
    const rows = journey(['I need activities', "I'm interested in hiking"]);
    expect(rows[0]!.components.followUpQuestion).toBe(ACTIVITIES_Q);
    expect(rows[0]!.reply).toContain(ACTIVITIES_Q);

    expect(rows[1]!.state.hikingWalkingRequested).toBe(true);
    expect(rows[1]!.state.activitiesRequested).toBe(true);
    expect(rows[1]!.classification.newlyEnabledRequestFlags).toEqual([
      'hikingWalkingRequested',
    ]);
    expect(rows[1]!.components.acknowledgementEvent).toEqual({
      kind: 'capability-enabled',
      capabilities: ['hiking and walking'],
    });
    expect(rows[1]!.components.followUpQuestion).toBe(NEUTRAL);
    expect(rows[1]!.reply).toBe(
      `Great, I've added hiking and walking to your trip. ${CAPABILITY_BRIDGE}`,
    );
    expect(rows[1]!.reply).not.toContain(ACTIVITIES_Q);
  });

  it('keeps activities suppressed across hiking then kayaking', () => {
    const rows = journey([
      'I need activities',
      'Hiking',
      'I also like kayaking',
    ]);
    expect(rows[1]!.components.followUpQuestion).toBe(NEUTRAL);
    expect(rows[1]!.reply).not.toContain(ACTIVITIES_Q);
    expect(rows[2]!.state.kayakingRequested).toBe(true);
    expect(rows[2]!.state.hikingWalkingRequested).toBe(true);
    expect(rows[2]!.components.followUpQuestion).toBe(NEUTRAL);
    expect(rows[2]!.reply).toBe(
      `Great, I've added kayaking to your trip. ${CAPABILITY_BRIDGE}`,
    );
    expect(rows[2]!.reply).not.toContain(ACTIVITIES_Q);
  });

  it('handles repeated activity input without re-asking activities', () => {
    const t = turn('Hiking', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
    });
    expect(t.classification.newlyEnabledRequestFlags).toEqual([]);
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.messageInterpreted).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toBe(
      `There's just one more thing I'd like to know. ${NEUTRAL}`,
    );
  });

  it('preserves Phase 18B unsupported behaviour after activities are satisfied', () => {
    const complete = journey(
      ["I'm interested in hiking", "I'm not sure"],
      { ...COMPLETE_CORE, activitiesRequested: true },
    );
    expect(complete[0]!.components.followUpQuestion).toBe(NEUTRAL);
    expect(complete[1]!.components.messageInterpreted).toBe(false);
    expect(complete[1]!.components.acknowledgement).toBeNull();
    expect(complete[1]!.components.followUpQuestion).toBe(NEUTRAL);
    expect(complete[1]!.reply).toBe(
      `There's just one more thing I'd like to know. ${NEUTRAL}`,
    );

    const incomplete = journey(
      ["I'm interested in hiking", "I'm not sure"],
      { destination: 'Cairns', activitiesRequested: true },
    );
    expect(incomplete[0]!.components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(incomplete[1]!.components.messageInterpreted).toBe(false);
    expect(incomplete[1]!.components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(incomplete[1]!.reply).toContain(FOLLOW_UPS.origin);
    expect(incomplete[1]!.reply).not.toContain(ACTIVITIES_Q);
  });

  it('keeps hiking-alone then unsupported on the terminal neutral path', () => {
    const rows = journey(['I want hiking', "I don't know"]);
    expect(rows[0]!.state.activitiesRequested).toBeNull();
    expect(rows[0]!.components.followUpQuestion).toBe(NEUTRAL);
    expect(rows[1]!.components.followUpQuestion).toBe(NEUTRAL);
    expect(rows[1]!.reply).toBe(
      `There's just one more thing I'd like to know. ${NEUTRAL}`,
    );
  });

  it('selects restaurants after activities are satisfied by a specific interest', () => {
    const t = turn("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      restaurantsRequested: true,
    });
    expect(t.state.hikingWalkingRequested).toBe(true);
    expect(t.components.followUpQuestion).toBe(FOLLOW_UPS.restaurants);
    expect(t.reply).toBe(
      `Great, I've added hiking and walking to your trip. ${FOLLOW_UPS.restaurants}`,
    );
  });
});
