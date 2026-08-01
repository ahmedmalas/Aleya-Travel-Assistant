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
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 19H — adult / passenger requirement policy audit.
 * Characterizes current service-gated behaviour only. Does not change policy.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ADULT_Q = FOLLOW_UPS.flightsAdultCount;
const GUEST_Q = FOLLOW_UPS.accommodationGuestCount;
const CHILD_Q = FOLLOW_UPS.childCount;
const INFANT_Q = FOLLOW_UPS.infantCount;
const ACTIVITIES_Q = FOLLOW_UPS.activities;
const RESTAURANTS_Q = FOLLOW_UPS.restaurants;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;

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
      conversationId: 'conversation-19h',
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
    userEntryId: 'user-19h',
    assistantEntryId: 'assistant-19h',
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

describe('Phase 19H — adult passenger requirement policy audit', () => {
  it('locks current service-gated passenger progression ownership', () => {
    const selector = readSrc(
      'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
    );
    expect(selector).toContain('needsChildCountFollowUp');
    expect(selector).toContain('needsInfantCountFollowUp');
    expect(selector).toMatch(
      /flightsRequested === true \|\| state\.accommodationRequested === true/,
    );
    // Car hire / activities / restaurants are not passenger-service gates.
    expect(selector).not.toMatch(
      /carHireRequested === true && state\.adultCount === null/,
    );
    expect(selector).not.toMatch(
      /activitiesRequested === true && state\.adultCount === null/,
    );
    expect(selector).not.toMatch(
      /restaurantsRequested === true && state\.adultCount === null/,
    );
  });

  it('characterizes no services enabled → no passenger questions', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(NEUTRAL);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: null,
    });
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ADULT_Q);
    expect(t.reply).not.toContain(GUEST_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    expect(t.reply).not.toContain(INFANT_Q);
  });

  it('characterizes flights only → passenger progression from adults', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: null,
          flightsRequested: true,
        }),
      ),
    ).toBe(ADULT_Q);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: null,
          flightsRequested: true,
        }),
      ),
    ).toBe(CHILD_Q);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: 2,
          infantCount: null,
          flightsRequested: true,
        }),
      ),
    ).toBe(INFANT_Q);
  });

  it('characterizes accommodation only → guest then child then infant', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: null,
          accommodationRequested: true,
        }),
      ),
    ).toBe(GUEST_Q);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: null,
          accommodationRequested: true,
        }),
      ),
    ).toBe(CHILD_Q);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: 1,
          infantCount: null,
          accommodationRequested: true,
        }),
      ),
    ).toBe(INFANT_Q);
  });

  it('characterizes car hire only → no passenger questions', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      carHireRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(NEUTRAL);

    const t = turn('hello there', {
      ...COMPLETE_CORE,
      adultCount: null,
      carHireRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ADULT_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    expect(t.reply).not.toContain(INFANT_Q);
  });

  it('characterizes activities only → activities question, not passenger counts', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      activitiesRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(ACTIVITIES_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: null,
      activitiesRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(ACTIVITIES_Q);
    expect(t.reply).not.toContain(ADULT_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    expect(t.reply).not.toContain(INFANT_Q);
  });

  it('characterizes restaurants only → dining preference question, not passenger counts', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      restaurantsRequested: true,
      restaurantPreference: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(RESTAURANTS_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: null,
      restaurantsRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(RESTAURANTS_Q);
    expect(t.reply).not.toContain(ADULT_Q);
  });

  it('characterizes flights + accommodation → adult asked once, then child, then infant', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: null,
          flightsRequested: true,
          accommodationRequested: true,
        }),
      ),
    ).toBe(ADULT_Q);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: null,
          flightsRequested: true,
          accommodationRequested: true,
        }),
      ),
    ).toBe(CHILD_Q);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: 2,
          infantCount: null,
          flightsRequested: true,
          accommodationRequested: true,
        }),
      ),
    ).toBe(INFANT_Q);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: 2,
          childCount: 2,
          infantCount: 1,
          flightsRequested: true,
          accommodationRequested: true,
        }),
      ),
    ).toBe(NEUTRAL);
  });

  it('characterizes car hire + activities → activities question, never passenger counts', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      carHireRequested: true,
      activitiesRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(ACTIVITIES_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      adultCount: null,
      carHireRequested: true,
      activitiesRequested: true,
    });
    expect(t.components.followUpQuestion).toBe(ACTIVITIES_Q);
    expect(t.reply).not.toContain(ADULT_Q);
  });

  it('characterizes complete core trip without passenger services → terminal continuation', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(NEUTRAL);

    const t = turn('sounds good', {
      ...COMPLETE_CORE,
      adultCount: null,
    });
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toContain(NEUTRAL);
  });

  it('characterizes unsupported input on complete core without passenger services → neutral', () => {
    const t = turn('asdf qwerty', {
      ...COMPLETE_CORE,
      adultCount: null,
    });
    expect(t.extracted).toEqual({});
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ADULT_Q);
    expect(t.reply).not.toContain(CHILD_Q);
    expect(t.reply).not.toContain(INFANT_Q);
  });

  it('characterizes volunteered counts without passenger services → persist + ack, no solicitation gate', () => {
    const adults = turn('2 adults', {
      ...COMPLETE_CORE,
      adultCount: null,
    });
    expect(adults.state.adultCount).toBe(2);
    expect(adults.components.acknowledgement).toMatch(/adult/i);
    expect(adults.components.followUpQuestion).toBe(NEUTRAL);

    const children = turn('2 children', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
    });
    expect(children.state.childCount).toBe(2);
    expect(children.components.acknowledgement).toMatch(/child/i);
    expect(children.components.followUpQuestion).toBe(NEUTRAL);

    const infants = turn('1 infant', {
      ...COMPLETE_CORE,
      adultCount: null,
      infantCount: null,
    });
    expect(infants.state.infantCount).toBe(1);
    expect(infants.components.acknowledgement).toMatch(/infant/i);
    expect(infants.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes that passenger counts are not required for activities or restaurants completion', () => {
    const activitiesDone = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      activitiesRequested: true,
      hikingWalkingRequested: true,
    });
    expect(selectConversationFollowUpQuestion(activitiesDone)).toBe(NEUTRAL);

    const diningDone = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      restaurantsRequested: true,
      restaurantPreference: 'seafood',
    });
    expect(selectConversationFollowUpQuestion(diningDone)).toBe(NEUTRAL);
  });
});
