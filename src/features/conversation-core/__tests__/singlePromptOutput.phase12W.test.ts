import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 12W — single-prompt output characterisation.
 *
 * Locks the invariant that one reply plan contains at most one user-facing
 * prompt across component selection, assembly, and rendering. Does not
 * re-cover the Phase 12A–12J priority matrix.
 */

const CONVERSATION_ID = 'conversation-core-phase-12w-single-prompt-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ALL_PROMPTS = Object.values(FOLLOW_UPS);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    }),
    status: 'active',
    turnCount: 1,
    ...overrides,
  };
}

function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-09-05',
    ...overrides,
  });
}

function planPipeline(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  const classification = classifyConversationStateChange(previousState, state);
  const components = selectConversationReplyComponents({
    state,
    classification,
  });
  const plan = assembleConversationReplyPlan(components);
  const rendered = renderConversationReplyPlan(plan);
  return { classification, components, plan, rendered };
}

function countQuestionMarks(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function countCataloguePrompts(text: string): number {
  return ALL_PROMPTS.filter((prompt) => text.includes(prompt)).length;
}

type Case = {
  name: string;
  previous: ConversationCoreState;
  state: ConversationCoreState;
  expectedPrompt: string;
  expectAcknowledgement?: boolean;
};

const REPRESENTATIVE_CASES: readonly Case[] = [
  {
    name: 'destination',
    previous: createState(),
    state: createState({ flightsRequested: true }),
    expectedPrompt: FOLLOW_UPS.destination,
    expectAcknowledgement: true,
  },
  {
    name: 'origin',
    previous: createState({ destination: 'Cairns' }),
    state: createState({
      destination: 'Cairns',
      accommodationRequested: true,
    }),
    expectedPrompt: FOLLOW_UPS.origin,
    expectAcknowledgement: true,
  },
  {
    name: 'departureDate',
    previous: createState({ destination: 'Cairns', origin: 'Sydney' }),
    state: createState({
      destination: 'Cairns',
      origin: 'Sydney',
      activitiesRequested: true,
    }),
    expectedPrompt: FOLLOW_UPS.departureDate,
    expectAcknowledgement: true,
  },
  {
    name: 'returnDate',
    previous: createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    }),
    state: createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      restaurantsRequested: true,
    }),
    expectedPrompt: FOLLOW_UPS.returnDate,
    expectAcknowledgement: true,
  },
  {
    name: 'flights adult count',
    previous: completeCore(),
    state: completeCore({ flightsRequested: true }),
    expectedPrompt: FOLLOW_UPS.flightsAdultCount,
    expectAcknowledgement: true,
  },
  {
    name: 'accommodation guest count',
    previous: completeCore(),
    state: completeCore({ accommodationRequested: true }),
    expectedPrompt: FOLLOW_UPS.accommodationGuestCount,
    expectAcknowledgement: true,
  },
  {
    name: 'activities',
    previous: completeCore({ adultCount: 2 }),
    state: completeCore({ adultCount: 2, activitiesRequested: true }),
    expectedPrompt: FOLLOW_UPS.activities,
    expectAcknowledgement: true,
  },
  {
    name: 'restaurants',
    previous: completeCore({ adultCount: 2 }),
    state: completeCore({ adultCount: 2, restaurantsRequested: true }),
    expectedPrompt: FOLLOW_UPS.restaurants,
    expectAcknowledgement: true,
  },
  {
    name: 'neutral continuation',
    previous: completeCore({ adultCount: 2 }),
    state: completeCore({ adultCount: 2, beachesRequested: true }),
    expectedPrompt: FOLLOW_UPS.neutralContinuation,
    expectAcknowledgement: true,
  },
];

describe('phase 12W — single-prompt output characterisation', () => {
  it('keeps a specific follow-up mutually exclusive with neutral continuation', () => {
    for (const entry of REPRESENTATIVE_CASES) {
      if (entry.expectedPrompt === FOLLOW_UPS.neutralContinuation) {
        continue;
      }

      const { components, plan, rendered } = planPipeline(
        entry.previous,
        entry.state,
      );

      expect(components.followUpQuestion, entry.name).toBe(entry.expectedPrompt);
      expect(components.continuationPrompt, entry.name).toBeNull();
      expect(components.followUpQuestion, entry.name).not.toBe(
        FOLLOW_UPS.neutralContinuation,
      );
      expect(plan.followUpQuestion, entry.name).toBe(entry.expectedPrompt);
      expect(plan.followUpQuestion, entry.name).not.toBe(
        FOLLOW_UPS.neutralContinuation,
      );
      expect(rendered.includes(FOLLOW_UPS.neutralContinuation), entry.name).toBe(
        false,
      );
      expect(rendered.includes(entry.expectedPrompt), entry.name).toBe(true);
    }
  });

  it('emits neutral continuation only when no specific follow-up exists', () => {
    const { components, plan, rendered } = planPipeline(
      completeCore({ adultCount: 2 }),
      completeCore({ adultCount: 2, beachesRequested: true }),
    );

    expect(components.followUpQuestion).toBe(FOLLOW_UPS.neutralContinuation);
    expect(components.continuationPrompt).toBeNull();
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.neutralContinuation);
    expect(rendered).toContain(FOLLOW_UPS.neutralContinuation);

    for (const prompt of ALL_PROMPTS) {
      if (prompt === FOLLOW_UPS.neutralContinuation) {
        continue;
      }
      expect(rendered.includes(prompt)).toBe(false);
    }
  });

  it('assembles at most one prompt component across representative cases', () => {
    for (const entry of REPRESENTATIVE_CASES) {
      const { components, plan } = planPipeline(entry.previous, entry.state);

      const selectedPromptCount = [
        components.followUpQuestion,
        components.continuationPrompt,
      ].filter((value) => value !== null).length;
      expect(selectedPromptCount, entry.name).toBeLessThanOrEqual(1);

      if (components.followUpQuestion !== null) {
        expect(components.continuationPrompt, entry.name).toBeNull();
      }

      expect(plan.followUpQuestion, entry.name).toBe(entry.expectedPrompt);
      expect(typeof plan.followUpQuestion, entry.name).toBe('string');
      expect(plan.followUpQuestion!.includes('\n'), entry.name).toBe(false);
      expect(countCataloguePrompts(plan.followUpQuestion!), entry.name).toBe(1);
    }
  });

  it('renders at most one question across representative cases', () => {
    for (const entry of REPRESENTATIVE_CASES) {
      const { plan, rendered } = planPipeline(entry.previous, entry.state);

      expect(countQuestionMarks(rendered), entry.name).toBe(1);
      expect(countCataloguePrompts(rendered), entry.name).toBe(1);
      expect(rendered.includes(entry.expectedPrompt), entry.name).toBe(true);

      const promptLines = rendered
        .split('\n')
        .filter((line) => ALL_PROMPTS.some((prompt) => line === prompt));
      expect(promptLines, entry.name).toHaveLength(1);
      expect(promptLines[0], entry.name).toBe(entry.expectedPrompt);
      expect(plan.followUpQuestion, entry.name).toBe(entry.expectedPrompt);
    }
  });

  it('does not let acknowledgement or messageInterpreted create a second prompt', () => {
    for (const entry of REPRESENTATIVE_CASES) {
      const { classification, components, plan, rendered } = planPipeline(
        entry.previous,
        entry.state,
      );

      expect(classification.hasInterpretedChange, entry.name).toBe(true);
      expect(components.messageInterpreted, entry.name).toBe(true);
      expect(plan.messageInterpreted, entry.name).toBe(true);

      if (entry.expectAcknowledgement) {
        expect(components.acknowledgement, entry.name).not.toBeNull();
        expect(plan.acknowledgements, entry.name).toHaveLength(1);
        expect(plan.acknowledgements[0]!.includes('?'), entry.name).toBe(false);
      }

      expect(countQuestionMarks(rendered), entry.name).toBe(1);
      expect(countCataloguePrompts(rendered), entry.name).toBe(1);

      if (plan.acknowledgements.length > 0) {
        expect(rendered.startsWith(plan.acknowledgements[0]!), entry.name).toBe(
          true,
        );
        expect(rendered, entry.name).toBe(
          `${plan.acknowledgements[0]}\n${entry.expectedPrompt}`,
        );
      }
    }

    // Uninterpreted turn on complete state: Phase 18B selects neutral follow-up
    // directly; continuation stays null; still one prompt.
    const previous = completeCore({ adultCount: 2 });
    const unchanged = completeCore({ adultCount: 2 });
    const { components, plan, rendered } = planPipeline(previous, unchanged);

    expect(components.messageInterpreted).toBe(false);
    expect(components.acknowledgement).toBeNull();
    expect(components.followUpQuestion).toBe(FOLLOW_UPS.neutralContinuation);
    expect(components.continuationPrompt).toBeNull();
    expect(plan.acknowledgements).toEqual([]);
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.neutralContinuation);
    expect(countQuestionMarks(rendered)).toBe(1);
    expect(countCataloguePrompts(rendered)).toBe(1);
    expect(rendered).toBe(FOLLOW_UPS.neutralContinuation);
  });
});
