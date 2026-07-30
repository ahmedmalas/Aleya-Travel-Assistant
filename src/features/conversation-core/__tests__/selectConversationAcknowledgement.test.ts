import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { classifyConversationStateChange, fieldValueChanged } from '../classifyConversationStateChange';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  createConversationReplyPlan,
} from '../createConversationReplyPlan';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';

const ROOT = process.cwd();
const SELECTOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationAcknowledgement.ts',
);
const PLAN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createConversationReplyPlan.ts',
);
const COMPONENTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationReplyComponents.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-10i',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
    ...overrides,
  });
}

function acknowledgementFor(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  return selectConversationAcknowledgement(
    state,
    classifyConversationStateChange(previousState, state),
  );
}

function planFor(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  return createConversationReplyPlan({
    state,
    classification: classifyConversationStateChange(previousState, state),
  });
}

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-10i',
    assistantEntryId: 'assistant-10i',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10I — deterministic acknowledgement selection boundary', () => {
  it('keeps the acknowledgement selector internal and consumed by the reply plan', () => {
    const selectorSource = readFileSync(SELECTOR_SOURCE, 'utf8');
    const planSource = readFileSync(PLAN_SOURCE, 'utf8');
    const componentsSource = readFileSync(COMPONENTS_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(selectorSource).toContain('Phase 10I');
    expect(selectorSource).toContain('Phase 10K');
    expect(selectorSource).toContain('Phase 11B');
    expect(selectorSource).toContain('Phase 11C');
    expect(selectorSource).toContain('Phase 11J');
    expect(selectorSource).toContain('Phase 11K');
    expect(selectorSource).toContain('Phase 11L');
    expect(selectorSource).toContain('Phase 11M');
    expect(selectorSource).toContain('Phase 11N');
    expect(selectorSource).toMatch(
      /export function selectConversationAcknowledgement/,
    );
    expect(selectorSource).toMatch(/destinationRemoved/);
    expect(selectorSource).toMatch(/originRemoved/);
    expect(selectorSource).toMatch(/departureDateRemoved/);
    expect(selectorSource).toMatch(/returnDateRemoved/);
    expect(selectorSource).toMatch(/adultCountRemoved/);
    expect(selectorSource).toMatch(/CAPABILITY_LABELS/);
    expect(selectorSource).toMatch(/\['toursRequested', 'tours'\]/);
    expect(selectorSource).toMatch(/\['eventsRequested', 'events'\]/);
    expect(selectorSource).toMatch(/\['nightlifeRequested', 'nightlife'\]/);
    expect(selectorSource).toMatch(/\['shoppingRequested', 'shopping'\]/);
    expect(selectorSource).toMatch(/\['wellnessRequested', 'wellness'\]/);
    expect(selectorSource).toMatch(
      /\['familyActivitiesRequested', 'family activities'\]/,
    );
    expect(selectorSource).toMatch(/\['flightsRequested', 'flights'\]/);
    expect(selectorSource).toMatch(
      /\['nationalParksRequested', 'national parks'\]/,
    );
    expect(selectorSource).toMatch(/CONVERSATION_REPLY_CATALOGUE/);
    expect(selectorSource).not.toMatch(/I've added \$\{/);
    expect(selectorSource).not.toMatch(/Great — \$\{/);
    expect(planSource).toContain('Phase 10I');
    expect(planSource).toMatch(/selectConversationReplyComponents\(/);
    expect(componentsSource).toMatch(/selectConversationAcknowledgement\(/);
    expect(planSource).not.toMatch(/CAPABILITY_LABELS|formatLabelList/);
    expect(planSource).not.toMatch(/I've added \$\{/);
    expect(planSource).not.toMatch(/Great —/);
    expect(index).not.toMatch(/selectConversationAcknowledgement/);
    expect(processTurn).not.toMatch(/selectConversationAcknowledgement/);
  });

  it('selects a new destination acknowledgement', () => {
    expect(
      acknowledgementFor(createState(), createState({ destination: 'Brisbane' })),
    ).toBe('Great — Brisbane.');
  });

  it('selects an updated destination acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({ destination: 'Brisbane' }),
        createState({ destination: 'Hobart' }),
      ),
    ).toBe('Great — Hobart.');
  });

  it('selects a new origin acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({ destination: 'Brisbane' }),
        createState({ destination: 'Brisbane', origin: 'Sydney' }),
      ),
    ).toBe('Perfect — departing from Sydney.');
  });

  it('selects an updated origin acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({ destination: 'Brisbane', origin: 'Sydney' }),
        createState({ destination: 'Brisbane', origin: 'Melbourne' }),
      ),
    ).toBe('Perfect — departing from Melbourne.');
  });

  it('selects one newly enabled capability acknowledgement', () => {
    expect(
      acknowledgementFor(completeCore(), completeCore({ flightsRequested: true })),
    ).toBe("I've added flights to your trip requirements.");
  });

  it('selects multiple newly enabled capabilities with stable label order', () => {
    expect(
      acknowledgementFor(
        completeCore(),
        completeCore({
          nationalParksRequested: true,
          flightsRequested: true,
          accommodationRequested: true,
          kayakingRequested: true,
        }),
      ),
    ).toBe(
      "I've added flights, accommodation, kayaking and national parks to your trip requirements.",
    );
  });

  it('preserves stable capability-label ordering independent of enablement order', () => {
    const reverseEnablement = acknowledgementFor(
      createState(),
      createState({
        wildlifeRequested: true,
        beachesRequested: true,
        restaurantsRequested: true,
        activitiesRequested: true,
      }),
    );
    const forwardEnablement = acknowledgementFor(
      createState(),
      createState({
        activitiesRequested: true,
        restaurantsRequested: true,
        beachesRequested: true,
        wildlifeRequested: true,
      }),
    );
    expect(reverseEnablement).toBe(forwardEnablement);
    expect(reverseEnablement).toBe(
      "I've added activities, restaurants, beaches and wildlife to your trip requirements.",
    );
  });

  it('selects a new departure-date acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      ),
    ).toBe('Perfect — departing on 2026-08-28.');
  });

  it('selects an updated departure-date acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-01',
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      ),
    ).toBe('Perfect — departing on 2026-08-28.');
  });

  it('selects a new return-date acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        }),
      ),
    ).toBe('Perfect — returning on 2026-09-05.');
  });

  it('selects an updated return-date acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-01',
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        }),
      ),
    ).toBe('Perfect — returning on 2026-09-05.');
  });

  it('selects a new adult-count acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 1,
        }),
      ),
    ).toBe('Perfect — 1 adult travelling.');
  });

  it('selects an updated adult-count acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 3,
        }),
      ),
    ).toBe('Perfect — 3 adults travelling.');
  });

  it('selects plural adult-count acknowledgement for two adults', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
        }),
      ),
    ).toBe('Perfect — 2 adults travelling.');
  });

  it('selects a child-count acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        }),
      ),
    ).toBe('Perfect — 1 child travelling.');
  });

  it('selects an updated child-count acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 2,
        }),
      ),
    ).toBe('Perfect — 2 children travelling.');
  });

  it('selects plural child-count acknowledgement for three children', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 2,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 3,
        }),
      ),
    ).toBe('Perfect — 3 children travelling.');
  });

  it('selects an infant-count acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
      ),
    ).toBe('Perfect — 1 infant travelling.');
  });

  it('selects an updated infant-count acknowledgement', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 2,
        }),
      ),
    ).toBe('Perfect — 2 infants travelling.');
  });

  it('selects plural infant-count acknowledgement for three infants', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 2,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 3,
        }),
      ),
    ).toBe('Perfect — 3 infants travelling.');
  });

  it('selects no acknowledgement for capability true→null clears', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
          flightsRequested: true,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
          flightsRequested: null,
        }),
      ),
    ).toBeNull();
  });

  it('does not select adult-count acknowledgement when adultCount is unchanged', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        }),
      ),
    ).toBe('Perfect — 1 child travelling.');
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
        }),
      ),
    ).toBeNull();
  });

  it('does not select child-count acknowledgement when childCount is unchanged', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
      ),
    ).toBe('Perfect — 1 infant travelling.');
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        }),
      ),
    ).toBeNull();
  });

  it('does not select infant-count acknowledgement when infantCount is unchanged', () => {
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
          toursRequested: true,
        }),
      ),
    ).toBe("I've added tours to your trip requirements.");
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
      ),
    ).toBeNull();
  });

  it('returns null for an unchanged state', () => {
    expect(
      acknowledgementFor(
        createState({ destination: 'Cairns' }),
        createState({ destination: 'Cairns' }),
      ),
    ).toBeNull();
  });

  it('applies deterministic priority when multiple change categories occur', () => {
    // capabilities beat destination + origin + dates + traveller counts
    expect(
      acknowledgementFor(
        createState(),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
          flightsRequested: true,
          accommodationRequested: true,
        }),
      ),
    ).toBe(
      "I've added flights and accommodation to your trip requirements.",
    );

    // destination beats origin / dates / traveller counts without new capabilities
    expect(
      acknowledgementFor(
        createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '2026-08-01',
          returnDate: '2026-09-01',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
        createState({
          destination: 'Hobart',
          origin: 'Melbourne',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 3,
          childCount: 2,
          infantCount: 2,
        }),
      ),
    ).toBe('Great — Hobart.');

    // origin beats departure/return dates / traveller counts and other changes
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-01',
          returnDate: '2026-09-01',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Melbourne',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 3,
          childCount: 2,
          infantCount: 2,
        }),
      ),
    ).toBe('Perfect — departing from Melbourne.');

    // departure date beats return date / traveller counts and generic changes
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-01',
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
      ),
    ).toBe('Perfect — departing on 2026-08-28.');

    // return date beats traveller counts and generic travel-field changes
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-01',
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
      ),
    ).toBe('Perfect — returning on 2026-09-05.');

    // adult count beats child/infant count and generic travel-field changes
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 3,
          childCount: 1,
          infantCount: 1,
        }),
      ),
    ).toBe('Perfect — 3 adults travelling.');

    // child count beats infant count and generic travel-field changes
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 2,
          infantCount: 1,
        }),
      ),
    ).toBe('Perfect — 2 children travelling.');

    // infant count beats generic travel-field changes
    expect(
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
          flightsRequested: true,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 2,
          flightsRequested: null,
        }),
      ),
    ).toBe('Perfect — 2 infants travelling.');
  });

  it('returns at most one acknowledgement string', () => {
    const samples = [
      acknowledgementFor(createState(), createState({ destination: 'Brisbane' })),
      acknowledgementFor(
        createState({ destination: 'Brisbane' }),
        createState({ destination: 'Brisbane', origin: 'Sydney' }),
      ),
      acknowledgementFor(completeCore(), completeCore({ flightsRequested: true })),
      acknowledgementFor(
        createState(),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
        }),
      ),
      acknowledgementFor(
        createState({ destination: 'Cairns' }),
        createState({ destination: 'Cairns' }),
      ),
      acknowledgementFor(
        createState({ destination: 'Cairns', origin: 'Sydney' }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          adultCount: 2,
        }),
      ),
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          adultCount: 2,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          adultCount: 2,
          childCount: 1,
        }),
      ),
      acknowledgementFor(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          adultCount: 2,
          childCount: 1,
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          adultCount: 2,
          childCount: 1,
          infantCount: 1,
        }),
      ),
    ];

    for (const acknowledgement of samples) {
      if (acknowledgement === null) {
        continue;
      }
      expect(typeof acknowledgement).toBe('string');
      expect(acknowledgement.includes('\n')).toBe(false);
    }
    expect(samples.filter((value) => value !== null)).toHaveLength(
      samples.length - 1,
    );
  });

  it('keeps reply-plan output, rendered replies, and messageInterpreted identical', () => {
    const cases: Array<{
      message: string;
      state: ConversationCoreState;
      stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'];
    }> = [
      { message: 'go to Brisbane', state: createState() },
      {
        message: 'from Sydney',
        state: createState({ destination: 'Brisbane' }),
      },
      { message: 'book flights', state: completeCore() },
      {
        message: 'book flights. book a hotel. book activities',
        state: completeCore({ adultCount: 2 }),
      },
      {
        message: 'Hello there',
        state: createState({ destination: 'Cairns' }),
      },
      {
        message: 'book flights. Fly from Sydney to Cairns',
        state: createState(),
      },
      {
        message: 'Hello',
        state: completeCore(),
        stateUpdate: { adultCount: 3, flightsRequested: true },
      },
      {
        message: 'change destination to Hobart',
        state: createState({ destination: 'Brisbane', origin: 'Sydney' }),
        stateUpdate: { destination: 'Hobart' },
      },
    ];

    for (const entry of cases) {
      const result = turn(entry.message, entry.state, entry.stateUpdate);
      const classification = classifyConversationStateChange(
        entry.state,
        result.state,
      );
      const acknowledgement = selectConversationAcknowledgement(
        result.state,
        classification,
      );
      const plan = planFor(entry.state, result.state);

      expect(plan.acknowledgements).toEqual(
        acknowledgement === null ? [] : [acknowledgement],
      );
      expect(plan.acknowledgements.length).toBeLessThanOrEqual(1);
      expect(plan.messageInterpreted).toBe(
        classification.hasInterpretedChange,
      );
      expect(renderConversationReplyPlan(plan), entry.message).toBe(
        result.reply,
      );
      expect(plan.messageInterpreted, entry.message).toBe(
        result.trace.messageInterpreted,
      );
      expect(
        generateConversationReply({
          message: entry.message,
          previousState: entry.state,
          state: result.state,
        }),
        entry.message,
      ).toBe(result.reply);

      if (!classification.hasAcknowledgementEligibleChange) {
        expect(acknowledgement).toBeNull();
      }
      if (!classification.hasInterpretedChange) {
        expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
      }
    }
  });

  describe('phase 10Z — passenger acknowledgement consolidation', () => {
    const passengerBase = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        ...overrides,
      });

    it('proves final singular and plural passenger acknowledgement wording', () => {
      expect(
        acknowledgementFor(passengerBase(), passengerBase({ adultCount: 1 })),
      ).toBe('Perfect — 1 adult travelling.');
      expect(
        acknowledgementFor(passengerBase(), passengerBase({ adultCount: 2 })),
      ).toBe('Perfect — 2 adults travelling.');

      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2 }),
          passengerBase({ adultCount: 2, childCount: 1 }),
        ),
      ).toBe('Perfect — 1 child travelling.');
      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2 }),
          passengerBase({ adultCount: 2, childCount: 2 }),
        ),
      ).toBe('Perfect — 2 children travelling.');

      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1 }),
          passengerBase({ adultCount: 2, childCount: 1, infantCount: 1 }),
        ),
      ).toBe('Perfect — 1 infant travelling.');
      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1 }),
          passengerBase({ adultCount: 2, childCount: 1, infantCount: 2 }),
        ),
      ).toBe('Perfect — 2 infants travelling.');
    });

    it('proves adult beats child and infant; child beats infant', () => {
      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1 }),
          passengerBase({ adultCount: 3, childCount: 2 }),
        ),
      ).toBe('Perfect — 3 adults travelling.');

      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, infantCount: 1 }),
          passengerBase({ adultCount: 3, infantCount: 2 }),
        ),
      ).toBe('Perfect — 3 adults travelling.');

      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1, infantCount: 1 }),
          passengerBase({ adultCount: 2, childCount: 2, infantCount: 2 }),
        ),
      ).toBe('Perfect — 2 children travelling.');
    });

    it('proves capability, destination, origin, and dates beat all passenger counts', () => {
      expect(
        acknowledgementFor(
          passengerBase(),
          passengerBase({
            adultCount: 2,
            childCount: 1,
            infantCount: 1,
            flightsRequested: true,
            accommodationRequested: true,
          }),
        ),
      ).toBe(
        "I've added flights and accommodation to your trip requirements.",
      );

      expect(
        acknowledgementFor(
          passengerBase({
            destination: 'Brisbane',
            adultCount: 2,
            childCount: 1,
            infantCount: 1,
          }),
          passengerBase({
            destination: 'Hobart',
            adultCount: 3,
            childCount: 2,
            infantCount: 2,
          }),
        ),
      ).toBe('Great — Hobart.');

      expect(
        acknowledgementFor(
          passengerBase({
            origin: 'Sydney',
            adultCount: 2,
            childCount: 1,
            infantCount: 1,
          }),
          passengerBase({
            origin: 'Melbourne',
            adultCount: 3,
            childCount: 2,
            infantCount: 2,
          }),
        ),
      ).toBe('Perfect — departing from Melbourne.');

      expect(
        acknowledgementFor(
          passengerBase({
            departureDate: '2026-08-01',
            adultCount: 2,
            childCount: 1,
            infantCount: 1,
          }),
          passengerBase({
            departureDate: '2026-08-28',
            adultCount: 3,
            childCount: 2,
            infantCount: 2,
          }),
        ),
      ).toBe('Perfect — departing on 2026-08-28.');

      expect(
        acknowledgementFor(
          passengerBase({
            returnDate: '2026-09-01',
            adultCount: 2,
            childCount: 1,
            infantCount: 1,
          }),
          passengerBase({
            returnDate: '2026-09-05',
            adultCount: 3,
            childCount: 2,
            infantCount: 2,
          }),
        ),
      ).toBe('Perfect — returning on 2026-09-05.');
    });

    it('enforces at most one acknowledgement across multi-passenger changes', () => {
      const samples = [
        acknowledgementFor(
          passengerBase(),
          passengerBase({
            adultCount: 2,
            childCount: 1,
            infantCount: 1,
          }),
        ),
        acknowledgementFor(
          passengerBase({ adultCount: 2 }),
          passengerBase({
            adultCount: 3,
            childCount: 1,
            infantCount: 1,
          }),
        ),
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1 }),
          passengerBase({
            adultCount: 2,
            childCount: 2,
            infantCount: 1,
          }),
        ),
        acknowledgementFor(
          passengerBase({
            adultCount: 2,
            childCount: 1,
            infantCount: 1,
            flightsRequested: true,
          }),
          passengerBase({
            adultCount: 2,
            childCount: 1,
            infantCount: 2,
            flightsRequested: null,
          }),
        ),
      ];

      expect(samples).toEqual([
        'Perfect — 2 adults travelling.',
        'Perfect — 3 adults travelling.',
        'Perfect — 2 children travelling.',
        'Perfect — 2 infants travelling.',
      ]);
      for (const acknowledgement of samples) {
        expect(acknowledgement).not.toBeNull();
        expect(typeof acknowledgement).toBe('string');
        expect(acknowledgement!.includes('\n')).toBe(false);
      }
    });

    it('does not acknowledge unchanged passenger counts', () => {
      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1, infantCount: 1 }),
          passengerBase({ adultCount: 2, childCount: 1, infantCount: 1 }),
        ),
      ).toBeNull();

      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2 }),
          passengerBase({ adultCount: 2, toursRequested: true }),
        ),
      ).toBe("I've added tours to your trip requirements.");
      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1 }),
          passengerBase({
            adultCount: 2,
            childCount: 1,
            toursRequested: true,
          }),
        ),
      ).toBe("I've added tours to your trip requirements.");
      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1, infantCount: 1 }),
          passengerBase({
            adultCount: 2,
            childCount: 1,
            infantCount: 1,
            toursRequested: true,
          }),
        ),
      ).toBe("I've added tours to your trip requirements.");
    });

    it('preserves traveller and guest follow-up suppression when passenger counts change', () => {
      const previous = completeCore({
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        flightsRequested: true,
        accommodationRequested: true,
        restaurantsRequested: true,
      });
      const state = completeCore({
        adultCount: 3,
        childCount: 2,
        infantCount: 2,
        flightsRequested: true,
        accommodationRequested: true,
        restaurantsRequested: true,
      });
      const plan = planFor(previous, state);

      expect(plan.acknowledgements).toEqual(['Perfect — 3 adults travelling.']);
      expect(plan.acknowledgements).toHaveLength(1);
      expect(plan.followUpQuestion).toBe(
        'What type of dining are you looking for?',
      );
      expect(plan.followUpQuestion).not.toMatch(/adults will be travelling/i);
      expect(plan.followUpQuestion).not.toMatch(/guests will be staying/i);
    });
  });

  describe('phase 11A — generic acknowledgement coverage characterisation', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        flightsRequested: true,
        ...overrides,
      });

    function classify(
      previousState: ConversationCoreState,
      state: ConversationCoreState,
    ) {
      return classifyConversationStateChange(previousState, state);
    }

    it('characterises service/capability true→false as removal acknowledgement', () => {
      const previous = filled();
      const disabled = filled({ flightsRequested: false });
      const classification = classify(previous, disabled);

      expect(classification.newlyEnabledRequestFlags).toEqual([]);
      expect(classification.newlyDisabledRequestFlags).toEqual([
        'flightsRequested',
      ]);
      expect(classification.updated).not.toContain('flightsRequested');
      expect(acknowledgementFor(previous, disabled)).toBe(
        "I've removed flights from your trip requirements.",
      );

      const clearedFlag = filled({ flightsRequested: null });
      expect(
        classify(previous, clearedFlag).newlyDisabledRequestFlags,
      ).toEqual([]);
      expect(acknowledgementFor(previous, clearedFlag)).toBeNull();
    });

    it('characterises formerly unlabeled capability enables as labelled acknowledgements', () => {
      const previous = filled();
      const expected: Record<string, string> = {
        toursRequested: "I've added tours to your trip requirements.",
        eventsRequested: "I've added events to your trip requirements.",
        nightlifeRequested: "I've added nightlife to your trip requirements.",
        shoppingRequested: "I've added shopping to your trip requirements.",
        wellnessRequested: "I've added wellness to your trip requirements.",
        familyActivitiesRequested:
          "I've added family activities to your trip requirements.",
      };
      for (const [field, acknowledgement] of Object.entries(expected)) {
        const next = filled({ [field]: true });
        const classification = classify(previous, next);
        expect(classification.newlyEnabledRequestFlags).toContain(field);
        expect(acknowledgementFor(previous, next)).toBe(acknowledgement);
      }
    });

    it('characterises destination/origin/date clears with dedicated removal wording', () => {
      const previous = filled();

      const destinationCleared = filled({ destination: null });
      expect(fieldValueChanged(classify(previous, destinationCleared), 'destination')).toBe(
        true,
      );
      expect(destinationCleared.destination).toBeNull();
      expect(acknowledgementFor(previous, destinationCleared)).toBe(
        'Destination removed.',
      );

      const originCleared = filled({ origin: null });
      expect(acknowledgementFor(previous, originCleared)).toBe(
        'Departure location removed.',
      );

      const departureCleared = filled({ departureDate: null });
      expect(acknowledgementFor(previous, departureCleared)).toBe(
        'Departure date removed.',
      );

      const returnCleared = filled({ returnDate: null });
      expect(acknowledgementFor(previous, returnCleared)).toBe(
        'Return date removed.',
      );
    });

    it('characterises adult clear with removal wording; child/infant clears as Perfect.', () => {
      const previous = filled();

      expect(
        acknowledgementFor(previous, filled({ adultCount: null })),
      ).toBe('Adult count removed.');
      expect(
        acknowledgementFor(previous, filled({ childCount: null })),
      ).toBe('Perfect.');
      expect(
        acknowledgementFor(previous, filled({ infantCount: null })),
      ).toBe('Perfect.');
    });

    it('characterises multiple removals including destination as Destination removed.', () => {
      const previous = filled();
      const next = filled({
        destination: null,
        origin: null,
        departureDate: null,
        returnDate: null,
        adultCount: null,
        childCount: null,
        infantCount: null,
      });
      const classification = classify(previous, next);

      expect(classification.hasAcknowledgementEligibleChange).toBe(true);
      expect(classification.newlyDisabledRequestFlags).toEqual([]);
      expect(acknowledgementFor(previous, next)).toBe('Destination removed.');
      expect(planFor(previous, next).acknowledgements).toEqual([
        'Destination removed.',
      ]);
    });

    it('characterises replacement-plus-removal priority against generic clears', () => {
      const previous = filled();

      // destination replacement beats adultCount clear
      expect(
        acknowledgementFor(
          previous,
          filled({ destination: 'Hobart', adultCount: null }),
        ),
      ).toBe('Great — Hobart.');

      // adultCount replacement beats childCount clear
      expect(
        acknowledgementFor(
          previous,
          filled({ adultCount: 3, childCount: null }),
        ),
      ).toBe('Perfect — 3 adults travelling.');

      // labeled capability enable beats destination clear
      expect(
        acknowledgementFor(
          previous,
          filled({
            destination: null,
            beachesRequested: true,
          }),
        ),
      ).toBe("I've added beaches to your trip requirements.");

      // formerly unlabeled capability enable with destination clear is now labelled
      expect(
        acknowledgementFor(
          previous,
          filled({
            destination: null,
            toursRequested: true,
          }),
        ),
      ).toBe("I've added tours to your trip requirements.");
    });

    it('characterises unchanged null values as no acknowledgement', () => {
      const previous = filled({
        childCount: null,
        infantCount: null,
        toursRequested: null,
      });
      const next = filled({
        childCount: null,
        infantCount: null,
        toursRequested: null,
      });
      const classification = classify(previous, next);

      expect(classification.hasAcknowledgementEligibleChange).toBe(false);
      expect(fieldValueChanged(classification, 'childCount')).toBe(false);
      expect(acknowledgementFor(previous, next)).toBeNull();
      expect(planFor(previous, next).acknowledgements).toEqual([]);
    });

    it('characterises adult-count clear with dedicated removal wording', () => {
      const previous = filled();
      const clearedAdult = filled({ adultCount: null });
      const classification = classify(previous, clearedAdult);

      // Classification still marks the field as changed…
      expect(classification.updated).toContain('adultCount');
      expect(fieldValueChanged(classification, 'adultCount')).toBe(true);
      // …and Phase 11N selects the adult-count removal acknowledgement
      // when the final value is null and adultCount is in updated.
      expect(clearedAdult.adultCount).toBeNull();
      expect(acknowledgementFor(previous, clearedAdult)).toBe(
        'Adult count removed.',
      );
    });

    it('characterises generic acknowledgement eligibility for residual travel changes', () => {
      // Phase 11E — null → false request-flag transitions enter
      // newlyDisabledRequestFlags and use removal wording, not Perfect.
      const previous = createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        accommodationRequested: null,
        kayakingRequested: null,
      });
      const nullToFalse = {
        ...previous,
        accommodationRequested: false as boolean | null,
      };
      const classification = classify(previous, nullToFalse);
      expect(classification.newlyEnabledRequestFlags).toEqual([]);
      expect(classification.newlyDisabledRequestFlags).toEqual([
        'accommodationRequested',
      ]);
      expect(classification.newlyPopulated).not.toContain(
        'accommodationRequested',
      );
      expect(acknowledgementFor(previous, nullToFalse)).toBe(
        "I've removed accommodation from your trip requirements.",
      );

      expect(
        acknowledgementFor(
          { ...previous, kayakingRequested: true },
          { ...previous, kayakingRequested: false },
        ),
      ).toBe("I've removed kayaking from your trip requirements.");
    });
  });

  describe('phase 11B — complete capability acknowledgement labels', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('acknowledges each formerly orphaned capability enable independently', () => {
      expect(
        acknowledgementFor(filled(), filled({ toursRequested: true })),
      ).toBe("I've added tours to your trip requirements.");
      expect(
        acknowledgementFor(filled(), filled({ eventsRequested: true })),
      ).toBe("I've added events to your trip requirements.");
      expect(
        acknowledgementFor(filled(), filled({ nightlifeRequested: true })),
      ).toBe("I've added nightlife to your trip requirements.");
      expect(
        acknowledgementFor(filled(), filled({ shoppingRequested: true })),
      ).toBe("I've added shopping to your trip requirements.");
      expect(
        acknowledgementFor(filled(), filled({ wellnessRequested: true })),
      ).toBe("I've added wellness to your trip requirements.");
      expect(
        acknowledgementFor(
          filled(),
          filled({ familyActivitiesRequested: true }),
        ),
      ).toBe("I've added family activities to your trip requirements.");
    });

    it('combines multiple newly enabled orphaned capabilities into one acknowledgement', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({
            toursRequested: true,
            eventsRequested: true,
            nightlifeRequested: true,
            shoppingRequested: true,
            wellnessRequested: true,
            familyActivitiesRequested: true,
          }),
        ),
      ).toBe(
        "I've added tours, events, nightlife, shopping, wellness and family activities to your trip requirements.",
      );
    });

    it('lets newly labelled capabilities beat destination, origin, dates, and passengers', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane' }),
          filled({
            destination: 'Hobart',
            toursRequested: true,
            adultCount: 3,
          }),
        ),
      ).toBe("I've added tours to your trip requirements.");

      expect(
        acknowledgementFor(
          filled({ origin: 'Sydney' }),
          filled({
            origin: 'Melbourne',
            eventsRequested: true,
            childCount: 2,
          }),
        ),
      ).toBe("I've added events to your trip requirements.");

      expect(
        acknowledgementFor(
          filled({ departureDate: '2026-08-01', returnDate: '2026-09-01' }),
          filled({
            departureDate: '2026-08-28',
            returnDate: '2026-09-05',
            nightlifeRequested: true,
            infantCount: 2,
          }),
        ),
      ).toBe("I've added nightlife to your trip requirements.");
    });

    it('preserves existing labelled capability acknowledgements', () => {
      expect(
        acknowledgementFor(filled(), filled({ flightsRequested: true })),
      ).toBe("I've added flights to your trip requirements.");
      expect(
        acknowledgementFor(
          filled(),
          filled({ beachesRequested: true, nationalParksRequested: true }),
        ),
      ).toBe(
        "I've added beaches and national parks to your trip requirements.",
      );
    });

    it('suppresses acknowledgement for capability true→null; null→false uses removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: null }),
        ),
      ).toBeNull();
      expect(
        acknowledgementFor(
          filled({ accommodationRequested: null }),
          filled({ accommodationRequested: false }),
        ),
      ).toBe("I've removed accommodation from your trip requirements.");
    });

    it('acknowledges capability true→false as removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");
    });

    it('still returns at most one acknowledgement for labelled orphan enables', () => {
      const acknowledgement = acknowledgementFor(
        filled(),
        filled({
          toursRequested: true,
          shoppingRequested: true,
          destination: 'Hobart',
          adultCount: 4,
        }),
      );
      expect(acknowledgement).toBe(
        "I've added tours and shopping to your trip requirements.",
      );
      expect(acknowledgement!.includes('\n')).toBe(false);
    });
  });

  describe('phase 11C — capability removal acknowledgement', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('classifies true→false and null→false into newlyDisabledRequestFlags', () => {
      const trueToFalse = classifyConversationStateChange(
        filled({ flightsRequested: true }),
        filled({ flightsRequested: false }),
      );
      expect(trueToFalse.newlyDisabledRequestFlags).toEqual([
        'flightsRequested',
      ]);
      expect(trueToFalse.updated).not.toContain('flightsRequested');
      expect(trueToFalse.newlyEnabledRequestFlags).toEqual([]);

      const trueToNull = classifyConversationStateChange(
        filled({ flightsRequested: true }),
        filled({ flightsRequested: null }),
      );
      expect(trueToNull.newlyDisabledRequestFlags).toEqual([]);
      expect(trueToNull.updated).toContain('flightsRequested');

      const nullToFalse = classifyConversationStateChange(
        filled({ flightsRequested: null }),
        filled({ flightsRequested: false }),
      );
      expect(nullToFalse.newlyDisabledRequestFlags).toEqual([
        'flightsRequested',
      ]);
      expect(nullToFalse.newlyPopulated).not.toContain('flightsRequested');

      const falseToFalse = classifyConversationStateChange(
        filled({ flightsRequested: false }),
        filled({ flightsRequested: false }),
      );
      expect(falseToFalse.newlyDisabledRequestFlags).toEqual([]);
      expect(falseToFalse.unchanged).toContain('flightsRequested');

      const falseToTrue = classifyConversationStateChange(
        filled({ flightsRequested: false }),
        filled({ flightsRequested: true }),
      );
      expect(falseToTrue.newlyEnabledRequestFlags).toEqual([
        'flightsRequested',
      ]);
      expect(falseToTrue.newlyDisabledRequestFlags).toEqual([]);
    });

    it('acknowledges single and multi capability removals', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({ toursRequested: true }),
          filled({ toursRequested: false }),
        ),
      ).toBe("I've removed tours from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({
            flightsRequested: true,
            accommodationRequested: true,
            carHireRequested: true,
          }),
          filled({
            flightsRequested: false,
            accommodationRequested: false,
            carHireRequested: false,
          }),
        ),
      ).toBe(
        "I've removed flights, accommodation and car hire from your trip requirements.",
      );
    });

    it('lets enable beat disable; disable beat lower acknowledgement branches', () => {
      expect(
        acknowledgementFor(
          filled({ accommodationRequested: true }),
          filled({
            accommodationRequested: false,
            toursRequested: true,
          }),
        ),
      ).toBe("I've added tours to your trip requirements.");

      expect(
        acknowledgementFor(
          filled({
            destination: 'Brisbane',
            flightsRequested: true,
          }),
          filled({
            destination: 'Hobart',
            flightsRequested: false,
            adultCount: 3,
          }),
        ),
      ).toBe("I've removed flights from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({
            origin: 'Sydney',
            flightsRequested: true,
          }),
          filled({
            origin: 'Melbourne',
            flightsRequested: false,
          }),
        ),
      ).toBe("I've removed flights from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({
            departureDate: '2026-08-01',
            returnDate: '2026-09-01',
            flightsRequested: true,
          }),
          filled({
            departureDate: '2026-08-28',
            returnDate: '2026-09-05',
            flightsRequested: false,
          }),
        ),
      ).toBe("I've removed flights from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({ flightsRequested: true, adultCount: 2 }),
          filled({ flightsRequested: false, adultCount: 3 }),
        ),
      ).toBe("I've removed flights from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");
    });

    it('suppresses true→null acknowledgement; preserves non-capability clears and addition wording; null→false uses removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: null }),
        ),
      ).toBeNull();
      expect(
        acknowledgementFor(
          filled({ accommodationRequested: null }),
          filled({ accommodationRequested: false }),
        ),
      ).toBe("I've removed accommodation from your trip requirements.");
      expect(
        acknowledgementFor(filled(), filled({ destination: null })),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(filled(), filled({ adultCount: null })),
      ).toBe('Adult count removed.');
      expect(
        acknowledgementFor(filled(), filled({ flightsRequested: true })),
      ).toBe("I've added flights to your trip requirements.");
    });

    it('returns at most one acknowledgement when capabilities are disabled', () => {
      const acknowledgement = acknowledgementFor(
        filled({
          flightsRequested: true,
          toursRequested: true,
        }),
        filled({
          flightsRequested: false,
          toursRequested: false,
          destination: 'Hobart',
          adultCount: 4,
        }),
      );
      expect(acknowledgement).toBe(
        "I've removed flights and tours from your trip requirements.",
      );
      expect(acknowledgement!.includes('\n')).toBe(false);
    });
  });

  describe('phase 11E — null→false capability disable handling', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('acknowledges single null→false capabilities with removal wording', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: null }),
          filled({ flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({ toursRequested: null }),
          filled({ toursRequested: false }),
        ),
      ).toBe("I've removed tours from your trip requirements.");
    });

    it('combines multiple null→false capabilities into one removal acknowledgement', () => {
      expect(
        acknowledgementFor(
          filled({
            flightsRequested: null,
            accommodationRequested: null,
            carHireRequested: null,
          }),
          filled({
            flightsRequested: false,
            accommodationRequested: false,
            carHireRequested: false,
          }),
        ),
      ).toBe(
        "I've removed flights, accommodation and car hire from your trip requirements.",
      );
    });

    it('combines mixed true→false and null→false into one removal acknowledgement', () => {
      expect(
        acknowledgementFor(
          filled({
            flightsRequested: true,
            toursRequested: null,
            shoppingRequested: null,
          }),
          filled({
            flightsRequested: false,
            toursRequested: false,
            shoppingRequested: false,
          }),
        ),
      ).toBe(
        "I've removed flights, tours and shopping from your trip requirements.",
      );
    });

    it('lets enable beat null→false disable; null→false disable beat lower branches', () => {
      expect(
        acknowledgementFor(
          filled({ accommodationRequested: null }),
          filled({
            accommodationRequested: false,
            toursRequested: true,
          }),
        ),
      ).toBe("I've added tours to your trip requirements.");

      expect(
        acknowledgementFor(
          filled({
            destination: 'Brisbane',
            flightsRequested: null,
          }),
          filled({
            destination: 'Hobart',
            flightsRequested: false,
            adultCount: 3,
          }),
        ),
      ).toBe("I've removed flights from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({
            departureDate: '2026-08-28',
            flightsRequested: null,
          }),
          filled({
            departureDate: '2026-09-01',
            flightsRequested: false,
          }),
        ),
      ).toBe("I've removed flights from your trip requirements.");

      expect(
        acknowledgementFor(
          filled({
            adultCount: 2,
            flightsRequested: null,
          }),
          filled({
            adultCount: 3,
            flightsRequested: false,
          }),
        ),
      ).toBe("I've removed flights from your trip requirements.");
    });

    it('suppresses true→null acknowledgement; destination clear uses removal wording', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: null }),
        ),
      ).toBeNull();
      expect(
        acknowledgementFor(filled(), filled({ destination: null })),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(filled(), filled({ adultCount: null })),
      ).toBe('Adult count removed.');
    });

    it('returns at most one acknowledgement for null→false disables', () => {
      const acknowledgement = acknowledgementFor(
        filled({
          flightsRequested: null,
          toursRequested: null,
        }),
        filled({
          flightsRequested: false,
          toursRequested: false,
          destination: 'Hobart',
          adultCount: 4,
        }),
      );
      expect(acknowledgement).toBe(
        "I've removed flights and tours from your trip requirements.",
      );
      expect(acknowledgement!.includes('\n')).toBe(false);
    });

    it('reaches null→false removal through processConversationTurn', () => {
      const previous = filled({ flightsRequested: null, adultCount: 2 });
      const result = turn('hello', previous, {
        flightsRequested: false,
      });
      expect(result.state.flightsRequested).toBe(false);
      expect(result.reply).toContain(
        "I've removed flights from your trip requirements.",
      );
      expect(result.reply).not.toMatch(/^Perfect\./);
    });
  });

  describe('phase 11F — suppress acknowledgements for true→null capability clears', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('produces no acknowledgement for true→null alone', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: null }),
        ),
      ).toBeNull();
      expect(
        planFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: null }),
        ).acknowledgements,
      ).toEqual([]);
    });

    it('produces no acknowledgement for false→null alone', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: false }),
          filled({ flightsRequested: null }),
        ),
      ).toBeNull();
    });

    it('lets destination beat a concurrent true→null clear', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane', flightsRequested: true }),
          filled({ destination: 'Hobart', flightsRequested: null }),
        ),
      ).toBe('Great — Hobart.');
    });

    it('lets newly enabled capability beat a concurrent true→null clear', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true, toursRequested: null }),
          filled({ flightsRequested: null, toursRequested: true }),
        ),
      ).toBe("I've added tours to your trip requirements.");
    });

    it('lets removal beat a concurrent true→null clear', () => {
      expect(
        acknowledgementFor(
          filled({
            flightsRequested: true,
            accommodationRequested: true,
          }),
          filled({
            flightsRequested: null,
            accommodationRequested: false,
          }),
        ),
      ).toBe("I've removed accommodation from your trip requirements.");
    });

    it('keeps non-destination clears on the generic Perfect. path', () => {
      expect(
        acknowledgementFor(filled(), filled({ destination: null })),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(filled(), filled({ adultCount: null })),
      ).toBe('Adult count removed.');
    });

    it('returns at most one acknowledgement when true→null co-occurs with other changes', () => {
      const acknowledgement = acknowledgementFor(
        filled({
          flightsRequested: true,
          toursRequested: null,
          destination: 'Brisbane',
        }),
        filled({
          flightsRequested: null,
          toursRequested: true,
          destination: 'Hobart',
          adultCount: 4,
        }),
      );
      expect(acknowledgement).toBe(
        "I've added tours to your trip requirements.",
      );
      expect(acknowledgement!.includes('\n')).toBe(false);
    });

    it('reaches true→null suppression through processConversationTurn', () => {
      const previous = filled({ flightsRequested: true, adultCount: 2 });
      const result = turn('hello', previous, { flightsRequested: null });
      expect(result.state.flightsRequested).toBeNull();
      expect(result.reply).not.toMatch(/Perfect\./);
      expect(result.reply).not.toMatch(/I've removed flights/);
      expect(result.trace.messageInterpreted).toBe(true);
    });
  });

  describe('phase 11G — suppress generic acknowledgement for interpretation-only changes', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('produces no acknowledgement when only interpretation-only changes occur', () => {
      const previous = filled({ flightsRequested: true });
      const next = filled({ flightsRequested: null });
      const classification = classifyConversationStateChange(previous, next);

      expect(classification.hasInterpretedChange).toBe(true);
      expect(classification.hasAcknowledgementEligibleChange).toBe(false);
      expect(acknowledgementFor(previous, next)).toBeNull();
      expect(planFor(previous, next).acknowledgements).toEqual([]);
      expect(planFor(previous, next).messageInterpreted).toBe(true);
    });

    it('lets destination beat an interpretation-only clear', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane', flightsRequested: true }),
          filled({ destination: 'Hobart', flightsRequested: null }),
        ),
      ).toBe('Great — Hobart.');
    });

    it('lets newly enabled capability beat an interpretation-only clear', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true, toursRequested: null }),
          filled({ flightsRequested: null, toursRequested: true }),
        ),
      ).toBe("I've added tours to your trip requirements.");
    });

    it('lets removal beat an interpretation-only clear', () => {
      expect(
        acknowledgementFor(
          filled({
            flightsRequested: true,
            accommodationRequested: true,
          }),
          filled({
            flightsRequested: null,
            accommodationRequested: false,
          }),
        ),
      ).toBe("I've removed accommodation from your trip requirements.");
    });

    it('keeps destination-removal and generic acknowledgement for genuine travel-field clears', () => {
      expect(
        acknowledgementFor(filled(), filled({ destination: null })),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ flightsRequested: null, adultCount: null }),
        ),
      ).toBe('Adult count removed.');
    });

    it('returns at most one acknowledgement when interpretation-only co-occurs', () => {
      const acknowledgement = acknowledgementFor(
        filled({
          flightsRequested: true,
          toursRequested: null,
          destination: 'Brisbane',
        }),
        filled({
          flightsRequested: null,
          toursRequested: true,
          destination: 'Hobart',
          adultCount: 4,
        }),
      );
      expect(acknowledgement).toBe(
        "I've added tours to your trip requirements.",
      );
      expect(acknowledgement!.includes('\n')).toBe(false);
    });

    it('reaches interpretation-only suppression through processConversationTurn', () => {
      const previous = filled({ flightsRequested: true, adultCount: 2 });
      const result = turn('hello', previous, { flightsRequested: null });
      expect(result.state.flightsRequested).toBeNull();
      expect(result.trace.messageInterpreted).toBe(true);
      expect(result.reply).not.toMatch(/Perfect\./);
      expect(result.reply).not.toMatch(/I've removed flights/);
      expect(result.reply).not.toMatch(/I've added /);
    });
  });

  describe('phase 11J — destination-removal acknowledgement', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('acknowledges stored destination → null as Destination removed.', () => {
      expect(
        acknowledgementFor(filled(), filled({ destination: null })),
      ).toBe('Destination removed.');
    });

    it('acknowledges null → stored destination with set wording', () => {
      expect(
        acknowledgementFor(
          createState({ destination: null }),
          createState({ destination: 'Brisbane' }),
        ),
      ).toBe('Great — Brisbane.');
    });

    it('acknowledges destination replacement with set wording', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane' }),
          filled({ destination: 'Hobart' }),
        ),
      ).toBe('Great — Hobart.');
    });

    it('produces no destination acknowledgement when destination is unchanged', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Cairns', adultCount: 2 }),
          filled({ destination: 'Cairns', adultCount: 3 }),
        ),
      ).toBe('Perfect — 3 adults travelling.');
      expect(
        acknowledgementFor(filled(), filled()),
      ).toBeNull();
    });

    it('preserves Perfect. for remaining non-removal clears alone', () => {
      expect(acknowledgementFor(filled(), filled({ origin: null }))).toBe(
        'Departure location removed.',
      );
      expect(
        acknowledgementFor(filled(), filled({ departureDate: null })),
      ).toBe('Departure date removed.');
      expect(acknowledgementFor(filled(), filled({ returnDate: null }))).toBe(
        'Return date removed.',
      );
      expect(acknowledgementFor(filled(), filled({ adultCount: null }))).toBe(
        'Adult count removed.',
      );
      expect(acknowledgementFor(filled(), filled({ childCount: null }))).toBe(
        'Perfect.',
      );
      expect(acknowledgementFor(filled(), filled({ infantCount: null }))).toBe(
        'Perfect.',
      );
    });

    it('lets newly enabled capability beat destination removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: null }),
          filled({ destination: null, flightsRequested: true }),
        ),
      ).toBe("I've added flights to your trip requirements.");
    });

    it('lets newly disabled capability beat destination removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ destination: null, flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");
    });

    it('lets destination removal beat origin, dates, passenger counts, and generic clears', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, origin: 'Melbourne' }),
        ),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, departureDate: '2026-10-01' }),
        ),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, returnDate: '2026-10-10' }),
        ),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, adultCount: 4 }),
        ),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, childCount: 3 }),
        ),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, infantCount: 2 }),
        ),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, origin: null, adultCount: null }),
        ),
      ).toBe('Destination removed.');
    });

    it('keeps destination set/changed wording when destination is non-null', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane' }),
          filled({ destination: 'Hobart', origin: null }),
        ),
      ).toBe('Great — Hobart.');
    });

    it('keeps messageInterpreted true for destination removal', () => {
      const previous = filled();
      const next = filled({ destination: null });
      const plan = planFor(previous, next);
      expect(plan.messageInterpreted).toBe(true);
      expect(plan.acknowledgements).toEqual(['Destination removed.']);
    });

    it('returns at most one acknowledgement for destination removal with other changes', () => {
      const acknowledgement = acknowledgementFor(
        filled({ flightsRequested: true }),
        filled({
          destination: null,
          origin: 'Melbourne',
          adultCount: 4,
          flightsRequested: null,
        }),
      );
      expect(acknowledgement).toBe('Destination removed.');
      expect(acknowledgement!.includes('\n')).toBe(false);
    });

    it('reaches destination removal through processConversationTurn', () => {
      const previous = filled();
      const result = turn('hello', previous, { destination: null });
      expect(result.state.destination).toBeNull();
      expect(result.reply).toContain('Destination removed.');
      expect(result.reply.match(/Destination removed\./g)?.length).toBe(1);
      expect(result.reply).not.toMatch(/Perfect\./);
      expect(result.trace.messageInterpreted).toBe(true);
    });
  });

  describe('phase 11K — origin-removal acknowledgement', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('acknowledges stored origin → null as Departure location removed.', () => {
      expect(acknowledgementFor(filled(), filled({ origin: null }))).toBe(
        'Departure location removed.',
      );
    });

    it('acknowledges null → stored origin with set wording', () => {
      expect(
        acknowledgementFor(
          createState({ origin: null, destination: 'Cairns' }),
          createState({ origin: 'Sydney', destination: 'Cairns' }),
        ),
      ).toBe('Perfect — departing from Sydney.');
    });

    it('acknowledges origin replacement with set wording', () => {
      expect(
        acknowledgementFor(
          filled({ origin: 'Sydney' }),
          filled({ origin: 'Melbourne' }),
        ),
      ).toBe('Perfect — departing from Melbourne.');
    });

    it('produces no origin acknowledgement when origin is unchanged', () => {
      expect(
        acknowledgementFor(
          filled({ origin: 'Sydney', adultCount: 2 }),
          filled({ origin: 'Sydney', adultCount: 3 }),
        ),
      ).toBe('Perfect — 3 adults travelling.');
      expect(acknowledgementFor(filled(), filled())).toBeNull();
    });

    it('preserves destination removal and Perfect. for remaining clears', () => {
      expect(
        acknowledgementFor(filled(), filled({ destination: null })),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(filled(), filled({ departureDate: null })),
      ).toBe('Departure date removed.');
      expect(acknowledgementFor(filled(), filled({ returnDate: null }))).toBe(
        'Return date removed.',
      );
      expect(acknowledgementFor(filled(), filled({ adultCount: null }))).toBe(
        'Adult count removed.',
      );
      expect(acknowledgementFor(filled(), filled({ childCount: null }))).toBe(
        'Perfect.',
      );
      expect(acknowledgementFor(filled(), filled({ infantCount: null }))).toBe(
        'Perfect.',
      );
    });

    it('lets newly enabled capability beat origin removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: null }),
          filled({ origin: null, flightsRequested: true }),
        ),
      ).toBe("I've added flights to your trip requirements.");
    });

    it('lets newly disabled capability beat origin removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ origin: null, flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");
    });

    it('lets destination set/changed beat origin removal', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane' }),
          filled({ destination: 'Hobart', origin: null }),
        ),
      ).toBe('Great — Hobart.');
    });

    it('lets destination removal beat origin removal', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, origin: null }),
        ),
      ).toBe('Destination removed.');
    });

    it('lets origin removal beat dates, passenger counts, and generic clears', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, departureDate: '2026-10-01' }),
        ),
      ).toBe('Departure location removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, returnDate: '2026-10-10' }),
        ),
      ).toBe('Departure location removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, adultCount: 4 }),
        ),
      ).toBe('Departure location removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, childCount: 3 }),
        ),
      ).toBe('Departure location removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, infantCount: 2 }),
        ),
      ).toBe('Departure location removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, adultCount: null, childCount: null }),
        ),
      ).toBe('Departure location removed.');
    });

    it('keeps origin set/changed wording when origin is non-null', () => {
      expect(
        acknowledgementFor(
          filled({ origin: 'Sydney' }),
          filled({ origin: 'Melbourne', adultCount: null }),
        ),
      ).toBe('Perfect — departing from Melbourne.');
    });

    it('keeps messageInterpreted true for origin removal', () => {
      const previous = filled();
      const next = filled({ origin: null });
      const plan = planFor(previous, next);
      expect(plan.messageInterpreted).toBe(true);
      expect(plan.acknowledgements).toEqual(['Departure location removed.']);
    });

    it('returns at most one acknowledgement for origin removal with other changes', () => {
      const acknowledgement = acknowledgementFor(
        filled({ flightsRequested: true }),
        filled({
          origin: null,
          departureDate: '2026-10-01',
          adultCount: 4,
          flightsRequested: null,
        }),
      );
      expect(acknowledgement).toBe('Departure location removed.');
      expect(acknowledgement!.includes('\n')).toBe(false);
    });

    it('reaches origin removal through processConversationTurn', () => {
      const previous = filled();
      const result = turn('hello', previous, { origin: null });
      expect(result.state.origin).toBeNull();
      expect(result.reply).toContain('Departure location removed.');
      expect(result.reply.match(/Departure location removed\./g)?.length).toBe(
        1,
      );
      expect(result.reply).not.toMatch(/Perfect\./);
      expect(result.trace.messageInterpreted).toBe(true);
    });
  });

  describe('phase 11L — departure-date removal acknowledgement', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('acknowledges stored departureDate → null as Departure date removed.', () => {
      expect(
        acknowledgementFor(filled(), filled({ departureDate: null })),
      ).toBe('Departure date removed.');
    });

    it('acknowledges null → stored departureDate with set wording', () => {
      expect(
        acknowledgementFor(
          createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: null,
          }),
          createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: '2026-08-28',
          }),
        ),
      ).toBe('Perfect — departing on 2026-08-28.');
    });

    it('acknowledges departureDate replacement with set wording', () => {
      expect(
        acknowledgementFor(
          filled({ departureDate: '2026-08-28' }),
          filled({ departureDate: '2026-10-01' }),
        ),
      ).toBe('Perfect — departing on 2026-10-01.');
    });

    it('produces no departure-date acknowledgement when departureDate is unchanged', () => {
      expect(
        acknowledgementFor(
          filled({ departureDate: '2026-08-28', adultCount: 2 }),
          filled({ departureDate: '2026-08-28', adultCount: 3 }),
        ),
      ).toBe('Perfect — 3 adults travelling.');
      expect(acknowledgementFor(filled(), filled())).toBeNull();
    });

    it('preserves prior removal wording and Perfect. for remaining clears', () => {
      expect(
        acknowledgementFor(filled(), filled({ destination: null })),
      ).toBe('Destination removed.');
      expect(acknowledgementFor(filled(), filled({ origin: null }))).toBe(
        'Departure location removed.',
      );
      expect(acknowledgementFor(filled(), filled({ returnDate: null }))).toBe(
        'Return date removed.',
      );
      expect(acknowledgementFor(filled(), filled({ adultCount: null }))).toBe(
        'Adult count removed.',
      );
      expect(acknowledgementFor(filled(), filled({ childCount: null }))).toBe(
        'Perfect.',
      );
      expect(acknowledgementFor(filled(), filled({ infantCount: null }))).toBe(
        'Perfect.',
      );
    });

    it('lets newly enabled capability beat departure-date removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: null }),
          filled({ departureDate: null, flightsRequested: true }),
        ),
      ).toBe("I've added flights to your trip requirements.");
    });

    it('lets newly disabled capability beat departure-date removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ departureDate: null, flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");
    });

    it('lets destination set/changed beat departure-date removal', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane' }),
          filled({ destination: 'Hobart', departureDate: null }),
        ),
      ).toBe('Great — Hobart.');
    });

    it('lets destination removal beat departure-date removal', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, departureDate: null }),
        ),
      ).toBe('Destination removed.');
    });

    it('lets origin set/changed beat departure-date removal', () => {
      expect(
        acknowledgementFor(
          filled({ origin: 'Sydney' }),
          filled({ origin: 'Melbourne', departureDate: null }),
        ),
      ).toBe('Perfect — departing from Melbourne.');
    });

    it('lets origin removal beat departure-date removal', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, departureDate: null }),
        ),
      ).toBe('Departure location removed.');
    });

    it('lets departure-date removal beat return date, passenger counts, and generic clears', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({ departureDate: null, returnDate: '2026-10-10' }),
        ),
      ).toBe('Departure date removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ departureDate: null, adultCount: 4 }),
        ),
      ).toBe('Departure date removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ departureDate: null, childCount: 3 }),
        ),
      ).toBe('Departure date removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ departureDate: null, infantCount: 2 }),
        ),
      ).toBe('Departure date removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({
            departureDate: null,
            returnDate: null,
            adultCount: null,
          }),
        ),
      ).toBe('Departure date removed.');
    });

    it('keeps departure-date set/changed wording when departureDate is non-null', () => {
      expect(
        acknowledgementFor(
          filled({ departureDate: '2026-08-28' }),
          filled({ departureDate: '2026-10-01', adultCount: null }),
        ),
      ).toBe('Perfect — departing on 2026-10-01.');
    });

    it('keeps messageInterpreted true for departure-date removal', () => {
      const previous = filled();
      const next = filled({ departureDate: null });
      const plan = planFor(previous, next);
      expect(plan.messageInterpreted).toBe(true);
      expect(plan.acknowledgements).toEqual(['Departure date removed.']);
    });

    it('returns at most one acknowledgement for departure-date removal with other changes', () => {
      const acknowledgement = acknowledgementFor(
        filled({ flightsRequested: true }),
        filled({
          departureDate: null,
          returnDate: '2026-10-10',
          adultCount: 4,
          flightsRequested: null,
        }),
      );
      expect(acknowledgement).toBe('Departure date removed.');
      expect(acknowledgement!.includes('\n')).toBe(false);
    });

    it('reaches departure-date removal through processConversationTurn', () => {
      const previous = filled();
      const result = turn('hello', previous, { departureDate: null });
      expect(result.state.departureDate).toBeNull();
      expect(result.reply).toContain('Departure date removed.');
      expect(result.reply.match(/Departure date removed\./g)?.length).toBe(1);
      expect(result.reply).not.toMatch(/Perfect\./);
      expect(result.trace.messageInterpreted).toBe(true);
    });
  });

  describe('phase 11M — return-date removal acknowledgement', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('acknowledges stored returnDate → null as Return date removed.', () => {
      expect(
        acknowledgementFor(filled(), filled({ returnDate: null })),
      ).toBe('Return date removed.');
    });

    it('does not acknowledge an unchanged null returnDate as removed', () => {
      expect(
        acknowledgementFor(
          filled({ returnDate: null, adultCount: 2 }),
          filled({ returnDate: null, adultCount: 3 }),
        ),
      ).toBe('Perfect — 3 adults travelling.');
      expect(
        acknowledgementFor(
          filled({ returnDate: null }),
          filled({ returnDate: null }),
        ),
      ).toBeNull();
    });

    it('acknowledges null → stored returnDate with set wording', () => {
      expect(
        acknowledgementFor(
          createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: '2026-08-28',
            returnDate: null,
          }),
          createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: '2026-08-28',
            returnDate: '2026-09-05',
          }),
        ),
      ).toBe('Perfect — returning on 2026-09-05.');
    });

    it('acknowledges returnDate replacement with set wording', () => {
      expect(
        acknowledgementFor(
          filled({ returnDate: '2026-09-05' }),
          filled({ returnDate: '2026-10-10' }),
        ),
      ).toBe('Perfect — returning on 2026-10-10.');
    });

    it('preserves higher-priority destination and origin acknowledgements', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane' }),
          filled({ destination: 'Hobart', returnDate: null }),
        ),
      ).toBe('Great — Hobart.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, returnDate: null }),
        ),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled({ origin: 'Sydney' }),
          filled({ origin: 'Melbourne', returnDate: null }),
        ),
      ).toBe('Perfect — departing from Melbourne.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, returnDate: null }),
        ),
      ).toBe('Departure location removed.');
    });

    it('lets departure-date set/change and removal beat return-date removal', () => {
      expect(
        acknowledgementFor(
          filled({ departureDate: '2026-08-28' }),
          filled({ departureDate: '2026-10-01', returnDate: null }),
        ),
      ).toBe('Perfect — departing on 2026-10-01.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ departureDate: null, returnDate: null }),
        ),
      ).toBe('Departure date removed.');
    });

    it('lets newly enabled and newly disabled capabilities beat return-date removal', () => {
      expect(
        acknowledgementFor(
          filled({ flightsRequested: null }),
          filled({ returnDate: null, flightsRequested: true }),
        ),
      ).toBe("I've added flights to your trip requirements.");
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ returnDate: null, flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");
    });

    it('lets return-date removal beat adult, child, infant, and generic clears', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({ returnDate: null, adultCount: 4 }),
        ),
      ).toBe('Return date removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ returnDate: null, childCount: 3 }),
        ),
      ).toBe('Return date removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ returnDate: null, infantCount: 2 }),
        ),
      ).toBe('Return date removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({
            returnDate: null,
            adultCount: null,
            childCount: null,
            infantCount: null,
          }),
        ),
      ).toBe('Return date removed.');
    });

    it('preserves adult-count removal and Perfect. for child/infant clears alone', () => {
      expect(acknowledgementFor(filled(), filled({ adultCount: null }))).toBe(
        'Adult count removed.',
      );
      expect(acknowledgementFor(filled(), filled({ childCount: null }))).toBe(
        'Perfect.',
      );
      expect(acknowledgementFor(filled(), filled({ infantCount: null }))).toBe(
        'Perfect.',
      );
    });

    it('keeps messageInterpreted true for return-date removal', () => {
      const previous = filled();
      const next = filled({ returnDate: null });
      const plan = planFor(previous, next);
      expect(plan.messageInterpreted).toBe(true);
      expect(plan.acknowledgements).toEqual(['Return date removed.']);
    });

    it('returns at most one acknowledgement for return-date removal with other changes', () => {
      const acknowledgement = acknowledgementFor(
        filled({ flightsRequested: true }),
        filled({
          returnDate: null,
          adultCount: 4,
          flightsRequested: null,
        }),
      );
      expect(acknowledgement).toBe('Return date removed.');
      expect(acknowledgement!.includes('\n')).toBe(false);
    });

    it('reaches return-date removal through processConversationTurn', () => {
      const previous = filled();
      const result = turn('hello', previous, { returnDate: null });
      expect(result.state.returnDate).toBeNull();
      expect(result.reply).toContain('Return date removed.');
      expect(result.reply.match(/Return date removed\./g)?.length).toBe(1);
      expect(result.reply).not.toMatch(/Perfect\./);
      expect(result.trace.messageInterpreted).toBe(true);
    });
  });

  describe('phase 11N — adult-count removal acknowledgement', () => {
    const filled = (
      overrides: Partial<ConversationCoreState> = {},
    ): ConversationCoreState =>
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        childCount: 1,
        infantCount: 1,
        ...overrides,
      });

    it('acknowledges stored adultCount → null as Adult count removed.', () => {
      expect(
        acknowledgementFor(filled(), filled({ adultCount: null })),
      ).toBe('Adult count removed.');
    });

    it('does not acknowledge an unchanged null adultCount as removed', () => {
      expect(
        acknowledgementFor(
          filled({ adultCount: null, childCount: 1 }),
          filled({ adultCount: null, childCount: 2 }),
        ),
      ).toBe('Perfect — 2 children travelling.');
      expect(
        acknowledgementFor(
          filled({ adultCount: null }),
          filled({ adultCount: null }),
        ),
      ).toBeNull();
    });

    it('acknowledges null → stored adultCount with set wording', () => {
      expect(
        acknowledgementFor(
          createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: '2026-08-28',
            returnDate: '2026-09-05',
            adultCount: null,
          }),
          createState({
            destination: 'Cairns',
            origin: 'Sydney',
            departureDate: '2026-08-28',
            returnDate: '2026-09-05',
            adultCount: 2,
          }),
        ),
      ).toBe('Perfect — 2 adults travelling.');
    });

    it('acknowledges adultCount replacement with set wording', () => {
      expect(
        acknowledgementFor(
          filled({ adultCount: 2 }),
          filled({ adultCount: 4 }),
        ),
      ).toBe('Perfect — 4 adults travelling.');
    });

    it('lets return-date set/change and removal beat adult-count removal', () => {
      expect(
        acknowledgementFor(
          filled({ returnDate: '2026-09-05' }),
          filled({ returnDate: '2026-10-10', adultCount: null }),
        ),
      ).toBe('Perfect — returning on 2026-10-10.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ returnDate: null, adultCount: null }),
        ),
      ).toBe('Return date removed.');
    });

    it('lets higher-priority destination, origin, departure, and capability acknowledgements win', () => {
      expect(
        acknowledgementFor(
          filled({ destination: 'Brisbane' }),
          filled({ destination: 'Hobart', adultCount: null }),
        ),
      ).toBe('Great — Hobart.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ destination: null, adultCount: null }),
        ),
      ).toBe('Destination removed.');
      expect(
        acknowledgementFor(
          filled({ origin: 'Sydney' }),
          filled({ origin: 'Melbourne', adultCount: null }),
        ),
      ).toBe('Perfect — departing from Melbourne.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ origin: null, adultCount: null }),
        ),
      ).toBe('Departure location removed.');
      expect(
        acknowledgementFor(
          filled({ departureDate: '2026-08-28' }),
          filled({ departureDate: '2026-10-01', adultCount: null }),
        ),
      ).toBe('Perfect — departing on 2026-10-01.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ departureDate: null, adultCount: null }),
        ),
      ).toBe('Departure date removed.');
      expect(
        acknowledgementFor(
          filled({ flightsRequested: null }),
          filled({ adultCount: null, flightsRequested: true }),
        ),
      ).toBe("I've added flights to your trip requirements.");
      expect(
        acknowledgementFor(
          filled({ flightsRequested: true }),
          filled({ adultCount: null, flightsRequested: false }),
        ),
      ).toBe("I've removed flights from your trip requirements.");
    });

    it('lets adult-count removal beat child, infant, and generic clears', () => {
      expect(
        acknowledgementFor(
          filled(),
          filled({ adultCount: null, childCount: 3 }),
        ),
      ).toBe('Adult count removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({ adultCount: null, infantCount: 2 }),
        ),
      ).toBe('Adult count removed.');
      expect(
        acknowledgementFor(
          filled(),
          filled({
            adultCount: null,
            childCount: null,
            infantCount: null,
          }),
        ),
      ).toBe('Adult count removed.');
    });

    it('preserves Perfect. for child-count and infant-count clears alone', () => {
      expect(acknowledgementFor(filled(), filled({ childCount: null }))).toBe(
        'Perfect.',
      );
      expect(acknowledgementFor(filled(), filled({ infantCount: null }))).toBe(
        'Perfect.',
      );
    });

    it('keeps messageInterpreted true for adult-count removal', () => {
      const previous = filled();
      const next = filled({ adultCount: null });
      const plan = planFor(previous, next);
      expect(plan.messageInterpreted).toBe(true);
      expect(plan.acknowledgements).toEqual(['Adult count removed.']);
    });

    it('returns at most one acknowledgement for adult-count removal with other changes', () => {
      const acknowledgement = acknowledgementFor(
        filled({ flightsRequested: true }),
        filled({
          adultCount: null,
          childCount: 3,
          flightsRequested: null,
        }),
      );
      expect(acknowledgement).toBe('Adult count removed.');
      expect(acknowledgement!.includes('\n')).toBe(false);
    });

    it('reaches adult-count removal through processConversationTurn', () => {
      const previous = filled();
      const result = turn('hello', previous, { adultCount: null });
      expect(result.state.adultCount).toBeNull();
      expect(result.reply).toContain('Adult count removed.');
      expect(result.reply.match(/Adult count removed\./g)?.length).toBe(1);
      expect(result.reply).not.toMatch(/Perfect\./);
      expect(result.trace.messageInterpreted).toBe(true);
    });
  });
});
