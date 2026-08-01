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
 * Phase 19A — conversation flow gap audit.
 * Characterizes current behaviour only. Does not fix defects.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACTIVITIES_Q = FOLLOW_UPS.activities;
const RESTAURANTS_Q = FOLLOW_UPS.restaurants;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const ADULT_Q = FOLLOW_UPS.flightsAdultCount;
const GUEST_Q = FOLLOW_UPS.accommodationGuestCount;
const ORIGIN_Q = FOLLOW_UPS.origin;

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
  adultCount: 2,
} as const;

/** Former Phase 19A gap flags — still in the activity completion set. */
const NON_EXTRACTABLE_ACTIVITY_FLAGS = [
  'accessibleTravelRequested',
  'toursRequested',
  'nightlifeRequested',
  'shoppingRequested',
  'wellnessRequested',
  'familyActivitiesRequested',
] as const;

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-19a',
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
  stateUpdate?: Partial<ConversationCoreState>,
) {
  const previous = createState(seed);
  const extracted = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-19a',
    assistantEntryId: 'assistant-19a',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
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

describe('Phase 19A — conversation flow gap audit', () => {
  it('locks that former gap flags remain in the activity completion set and are now registered', () => {
    const factory = readSrc(
      'src/features/conversation-core/createConversationStateExtractor.ts',
    );
    for (const name of [
      'ToursRequestedConversationStateExtractor',
      'NightlifeRequestedConversationStateExtractor',
      'ShoppingRequestedConversationStateExtractor',
      'WellnessRequestedConversationStateExtractor',
      'FamilyActivitiesRequestedConversationStateExtractor',
      'AccessibleTravelRequestedConversationStateExtractor',
    ]) {
      expect(factory, name).toContain(name);
    }

    const selector = readSrc(
      'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
    );
    for (const flag of NON_EXTRACTABLE_ACTIVITY_FLAGS) {
      expect(selector, flag).toContain(`'${flag}'`);
    }
  });

  it('characterizes shopping under open activities follow-up (Phase 19B extraction)', () => {
    const t = turn('Shopping', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.state.shoppingRequested).toBe(true);
    expect(t.components.acknowledgement).toContain('shopping');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
  });

  it('characterizes nightlife under open activities follow-up (Phase 19B extraction)', () => {
    const t = turn('Nightlife', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.state.nightlifeRequested).toBe(true);
    expect(t.components.acknowledgement).toContain('nightlife');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes wellness under open activities follow-up (Phase 19B extraction)', () => {
    const t = turn('Wellness activities', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.state.wellnessRequested).toBe(true);
    expect(t.components.acknowledgement).toContain('wellness');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes tours / family / accessible travel as extractable from message text (Phase 19B)', () => {
    for (const entry of [
      {
        message: 'I want tours',
        flag: 'toursRequested' as const,
      },
      {
        message: 'family activities',
        flag: 'familyActivitiesRequested' as const,
      },
      {
        message: 'wheelchair accessible',
        flag: 'accessibleTravelRequested' as const,
      },
    ]) {
      const t = turn(entry.message, {
        ...COMPLETE_CORE,
        activitiesRequested: true,
      });
      expect(t.state[entry.flag], entry.message).toBe(true);
      expect(t.components.followUpQuestion, entry.message).toBe(NEUTRAL);
    }
  });

  it('characterizes unified events model after Phase 19C', () => {
    const localEvents = turn('find local events', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(localEvents.state.eventsFestivalsRequested).toBe(true);
    expect(localEvents.components.followUpQuestion).toBe(NEUTRAL);

    const festivals = turn('I want festivals', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(festivals.state.eventsFestivalsRequested).toBe(true);
    expect(festivals.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes explicit-only tours path still completes activities when trusted', () => {
    const t = turn(
      'please note tours',
      {
        ...COMPLETE_CORE,
        activitiesRequested: true,
      },
      { toursRequested: true },
    );
    expect(t.state.toursRequested).toBe(true);
    expect(t.components.acknowledgement).toContain('tours');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
  });

  it('characterizes adultCount solicitation only for flights or accommodation', () => {
    const none = createState({
      ...COMPLETE_CORE,
      adultCount: null,
    });
    expect(selectConversationFollowUpQuestion(none)).toBe(NEUTRAL);

    const carOnly = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      carHireRequested: true,
    });
    expect(selectConversationFollowUpQuestion(carOnly)).toBe(NEUTRAL);

    const flights = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(selectConversationFollowUpQuestion(flights)).toBe(ADULT_Q);

    const accommodation = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(selectConversationFollowUpQuestion(accommodation)).toBe(GUEST_Q);
  });

  it('characterizes childCount and infantCount as never solicited by the selector', () => {
    const followUps = FOLLOW_UPS as Record<string, string>;
    expect(Object.keys(followUps)).not.toContain('childCount');
    expect(Object.keys(followUps)).not.toContain('infantCount');

    const selector = readSrc(
      'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
    );
    expect(selector).not.toMatch(/childCount/);
    expect(selector).not.toMatch(/infantCount/);

    const state = createState({
      ...COMPLETE_CORE,
      flightsRequested: true,
      adultCount: 2,
      childCount: null,
      infantCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(NEUTRAL);
  });

  it('characterizes volunteering children while adult count remains open', () => {
    const t = turn('2 children', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(t.state.childCount).toBe(2);
    expect(t.state.adultCount).toBeNull();
    expect(t.components.acknowledgement).toMatch(/child/i);
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
  });

  it('characterizes bare numeric adult answers as non-extracting', () => {
    const bare = turn('2', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(bare.extracted).toEqual({});
    expect(bare.state.adultCount).toBeNull();
    expect(bare.components.followUpQuestion).toBe(ADULT_Q);

    const cued = turn('2 adults', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(cued.state.adultCount).toBe(2);
    expect(cued.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes guest-question answers that lack adult cues', () => {
    const guests = turn('2 guests', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(guests.state.adultCount).toBeNull();
    expect(guests.components.followUpQuestion).toBe(GUEST_Q);

    const adults = turn('2 adults', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(adults.state.adultCount).toBe(2);
    expect(adults.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes restaurantPreference acknowledgement as generic-only', () => {
    const ackSource = readSrc(
      'src/features/conversation-core/selectConversationAcknowledgement.ts',
    );
    expect(ackSource).not.toMatch(/restaurantPreference/);

    const t = turn('looking for seafood', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
    });
    expect(t.state.restaurantPreference).toBe('seafood');
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.components.acknowledgement).toBe(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.genericTravelFieldChange,
    );
    expect(t.reply).not.toContain(RESTAURANTS_Q);
  });

  it('characterizes repeated hiking and repeated seafood as unchanged', () => {
    const hiking = turn("I'm interested in hiking", {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      hikingWalkingRequested: true,
    });
    expect(hiking.classification.hasInterpretedChange).toBe(false);
    expect(hiking.components.acknowledgement).toBeNull();
    expect(hiking.components.followUpQuestion).toBe(NEUTRAL);
    expect(hiking.reply).not.toContain(ACTIVITIES_Q);

    const seafood = turn('seafood', {
      ...COMPLETE_CORE,
      restaurantsRequested: true,
      restaurantPreference: 'seafood',
    });
    expect(seafood.classification.hasInterpretedChange).toBe(false);
    expect(seafood.components.acknowledgement).toBeNull();
    expect(seafood.components.followUpQuestion).toBe(NEUTRAL);
    expect(seafood.reply).not.toContain(RESTAURANTS_Q);
  });

  it('characterizes Phase 18B unsupported progression still holds', () => {
    const incomplete = turn("I'm not sure yet", {
      destination: 'Cairns',
      flightsRequested: true,
    });
    expect(incomplete.classification.hasInterpretedChange).toBe(false);
    expect(incomplete.components.acknowledgement).toBeNull();
    expect(incomplete.components.followUpQuestion).toBe(ORIGIN_Q);

    const complete = turn("I'm not sure yet", COMPLETE_CORE);
    expect(complete.classification.hasInterpretedChange).toBe(false);
    expect(complete.components.acknowledgement).toBeNull();
    expect(complete.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('verifies extractable activity interests still complete the activities follow-up', () => {
    const cases = [
      { message: "I'm interested in hiking", flag: 'hikingWalkingRequested' },
      { message: 'beaches', flag: 'beachesRequested' },
      { message: 'national parks', flag: 'nationalParksRequested' },
    ] as const;

    for (const entry of cases) {
      const t = turn(entry.message, {
        ...COMPLETE_CORE,
        activitiesRequested: true,
      });
      expect(t.state[entry.flag], entry.message).toBe(true);
      expect(t.components.followUpQuestion, entry.message).toBe(NEUTRAL);
      expect(t.reply, entry.message).not.toContain(ACTIVITIES_Q);
    }
  });

  it('verifies core progression fields remain asked until set', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({ destination: null }),
      ),
    ).toBe(FOLLOW_UPS.destination);
    expect(
      selectConversationFollowUpQuestion(
        createState({ destination: 'Cairns', origin: null }),
      ),
    ).toBe(FOLLOW_UPS.origin);
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);
  });
});
