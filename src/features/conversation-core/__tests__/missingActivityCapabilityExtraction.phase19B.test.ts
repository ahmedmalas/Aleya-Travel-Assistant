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
 * Phase 19B — missing activity capability extractors.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACTIVITIES_Q = FOLLOW_UPS.activities;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
  adultCount: 2,
} as const;

type CapabilityFlag =
  | 'nightlifeRequested'
  | 'shoppingRequested'
  | 'wellnessRequested'
  | 'toursRequested'
  | 'familyActivitiesRequested'
  | 'accessibleTravelRequested';

const FLAG_ROWS: Array<{
  flag: CapabilityFlag;
  label: string;
  clearEnable: string;
  naturalEnable: string;
  clearRemoval: string;
}> = [
  {
    flag: 'nightlifeRequested',
    label: 'nightlife',
    clearEnable: 'I want nightlife',
    naturalEnable: 'We would like bars and clubs',
    clearRemoval: 'Remove nightlife',
  },
  {
    flag: 'shoppingRequested',
    label: 'shopping',
    clearEnable: 'Include shopping',
    naturalEnable: 'I want to go shopping',
    clearRemoval: 'No shopping',
  },
  {
    flag: 'wellnessRequested',
    label: 'wellness',
    clearEnable: 'Add wellness activities',
    naturalEnable: 'We would like spa and wellness options',
    clearRemoval: 'We do not need wellness activities',
  },
  {
    flag: 'toursRequested',
    label: 'tours',
    clearEnable: 'Include tours',
    naturalEnable: 'We want guided tours',
    clearRemoval: 'Remove tours',
  },
  {
    flag: 'familyActivitiesRequested',
    label: 'family activities',
    clearEnable: 'Add family activities',
    naturalEnable: 'We need family-friendly activities',
    clearRemoval: 'No family activities',
  },
  {
    flag: 'accessibleTravelRequested',
    label: 'accessible travel',
    clearEnable: 'We need accessible travel options',
    naturalEnable: 'Include wheelchair-accessible activities',
    clearRemoval: 'Remove accessible travel',
  },
];

const ALL_FLAGS: CapabilityFlag[] = FLAG_ROWS.map((row) => row.flag);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-19b',
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
    userEntryId: 'user-19b',
    assistantEntryId: 'assistant-19b',
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

function unrelatedFlagsRemainNull(
  state: ConversationCoreState,
  enabled: CapabilityFlag,
): void {
  for (const flag of ALL_FLAGS) {
    if (flag === enabled) {
      expect(state[flag]).toBe(true);
    } else {
      expect(state[flag], flag).toBeNull();
    }
  }
}

describe('Phase 19B — missing activity capability extraction', () => {
  it('registers all seven Phase 19B extractors before Empty', () => {
    const factory = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/createConversationStateExtractor.ts',
      ),
      'utf8',
    );
    for (const name of [
      'NightlifeRequestedConversationStateExtractor',
      'ShoppingRequestedConversationStateExtractor',
      'WellnessRequestedConversationStateExtractor',
      'ToursRequestedConversationStateExtractor',
      'FamilyActivitiesRequestedConversationStateExtractor',
      'AccessibleTravelRequestedConversationStateExtractor',
    ]) {
      expect(factory).toContain(name);
    }
    expect(factory).toMatch(
      /new NationalParksRequestedConversationStateExtractor\(\),\s*new NightlifeRequestedConversationStateExtractor\(\),\s*new ShoppingRequestedConversationStateExtractor\(\),\s*new WellnessRequestedConversationStateExtractor\(\),\s*new ToursRequestedConversationStateExtractor\(\),\s*new FamilyActivitiesRequestedConversationStateExtractor\(\),\s*new AccessibleTravelRequestedConversationStateExtractor\(\),\s*new BareNumberPassengerCountConversationStateExtractor\(\),\s*new ExplicitGuestCountConversationStateExtractor\(\),\s*new EmptyConversationStateExtractor\(\),/,
    );
  });

  it.each(FLAG_ROWS)(
    'enables $flag from clear and natural phrases with ack and persistence',
    (row) => {
      for (const message of [row.clearEnable, row.naturalEnable]) {
        const t = turn(message, {
          ...COMPLETE_CORE,
          activitiesRequested: true,
        });
        expect(t.extracted[row.flag], message).toBe(true);
        expect(t.state[row.flag], message).toBe(true);
        expect(t.classification.hasInterpretedChange, message).toBe(true);
        expect(t.classification.newlyEnabledRequestFlags, message).toContain(
          row.flag,
        );
        expect(t.components.acknowledgement, message).toContain(row.label);
        expect(t.components.followUpQuestion, message).toBe(NEUTRAL);
        expect(t.reply, message).not.toContain(ACTIVITIES_Q);
        unrelatedFlagsRemainNull(t.state, row.flag);
      }
    },
  );

  it.each(FLAG_ROWS)(
    'treats repeated $flag enablement as unchanged',
    (row) => {
      const t = turn(row.clearEnable, {
        ...COMPLETE_CORE,
        activitiesRequested: true,
        [row.flag]: true,
      });
      expect(t.state[row.flag]).toBe(true);
      expect(t.classification.hasInterpretedChange).toBe(false);
      expect(t.classification.newlyEnabledRequestFlags).not.toContain(row.flag);
      expect(t.components.acknowledgement).toBeNull();
      expect(t.components.followUpQuestion).toBe(NEUTRAL);
      expect(t.reply).not.toContain(ACTIVITIES_Q);
    },
  );

  it.each(FLAG_ROWS)(
    'blocks clear removal wording for $flag without inventing false',
    (row) => {
      const t = turn(row.clearRemoval, {
        ...COMPLETE_CORE,
        activitiesRequested: true,
        [row.flag]: true,
      });
      expect(t.extracted[row.flag]).toBeUndefined();
      expect(t.state[row.flag]).toBe(true);
      expect(t.classification.newlyDisabledRequestFlags).not.toContain(
        row.flag,
      );
    },
  );

  it('rejects shopping-for-flights false positive', () => {
    const t = turn('I am shopping for flights', COMPLETE_CORE);
    expect(t.state.shoppingRequested).toBeNull();
    expect(t.extracted.shoppingRequested).toBeUndefined();
  });

  it('rejects family-trip false positive', () => {
    const t = turn('This is a family trip', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.state.familyActivitiesRequested).toBeNull();
    expect(t.components.followUpQuestion).toBe(ACTIVITIES_Q);
  });

  it('rejects expensive-tours question false positive', () => {
    const t = turn('Are tours expensive?', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.state.toursRequested).toBeNull();
    expect(t.components.followUpQuestion).toBe(ACTIVITIES_Q);
  });

  it('defers events/festivals unification to Phase 19C canonical field', () => {
    // Phase 19C unifies both phrases onto eventsFestivalsRequested.
    const festivals = turn('I want festivals', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(festivals.state.eventsFestivalsRequested).toBe(true);
    expect(festivals.components.followUpQuestion).toBe(NEUTRAL);

    const events = turn('I want events', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(events.state.eventsFestivalsRequested).toBe(true);
    expect(events.components.acknowledgement).toContain('events and festivals');
    expect(events.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('rejects additional conservative false positives', () => {
    const cases: Array<{
      message: string;
      flag: CapabilityFlag | 'eventsFestivalsRequested';
    }> = [
      { message: 'Is the nightlife safe?', flag: 'nightlifeRequested' },
      {
        message: 'The hotel offers wellness facilities',
        flag: 'wellnessRequested',
      },
      {
        message: 'Are accessible rooms available?',
        flag: 'accessibleTravelRequested',
      },
      { message: 'What events are happening?', flag: 'eventsFestivalsRequested' },
    ];
    for (const entry of cases) {
      const t = turn(entry.message, {
        ...COMPLETE_CORE,
        activitiesRequested: true,
      });
      expect(t.state[entry.flag], entry.message).toBeNull();
    }
  });
});
