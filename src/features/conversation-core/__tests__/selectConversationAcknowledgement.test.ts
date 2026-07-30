import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
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
    expect(selectorSource).toMatch(
      /export function selectConversationAcknowledgement/,
    );
    expect(selectorSource).toMatch(/CAPABILITY_LABELS/);
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

  it('selects Perfect for other changed travel fields', () => {
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
    ).toBe('Perfect.');
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
    ).toBe('Perfect.');
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
        }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
          infantCount: 2,
          toursRequested: true,
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
      expect(plan.messageInterpreted).toBe(classification.hasAnyChange);
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

      if (!classification.hasAnyChange) {
        expect(acknowledgement).toBeNull();
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
          passengerBase({ adultCount: 2, childCount: 1, infantCount: 1 }),
          passengerBase({
            adultCount: 2,
            childCount: 1,
            infantCount: 2,
            toursRequested: true,
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
      ).toBe('Perfect.');
      expect(
        acknowledgementFor(
          passengerBase({ adultCount: 2, childCount: 1 }),
          passengerBase({
            adultCount: 2,
            childCount: 1,
            toursRequested: true,
          }),
        ),
      ).toBe('Perfect.');
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
      ).toBe('Perfect.');
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
});
