import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import {
  CONVERSATION_REPLY_CATALOGUE,
} from '../conversationReplyCatalogue';
import {
  createConversationalLayerInput,
  identifyConversationalObjective,
  type ConversationalLayerInput,
  type ConversationalLayerOutput,
  type ConversationalObjective,
  type ConversationalStyleProfile,
} from '../conversationalLayerContracts';

/**
 * Phase 13C — conversational layer contract characterisation.
 *
 * Locks the TypeScript contract boundary for the future Travel Consultant
 * layer without wiring it into reply generation.
 */

const ROOT = process.cwd();
const CONTRACTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/conversationalLayerContracts.ts',
);
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const CREATE_PLAN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createConversationReplyPlan.ts',
);

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function samplePlan(
  overrides: Partial<ConversationReplyPlan> = {},
): ConversationReplyPlan {
  return {
    acknowledgements: ['Great — Brisbane.'],
    followUpQuestion: FOLLOW_UPS.origin,
    messageInterpreted: true,
    ...overrides,
  };
}

describe('phase 13C — conversational layer contracts', () => {
  it('keeps contracts free of external APIs and runtime reply integration', () => {
    const contracts = readFileSync(CONTRACTS_SOURCE, 'utf8');
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const createPlan = readFileSync(CREATE_PLAN_SOURCE, 'utf8');

    expect(contracts.includes('OpenAI')).toBe(false);
    expect(contracts.includes('Anthropic')).toBe(false);
    expect(contracts.includes('LLM')).toBe(false);
    expect(contracts.includes('fetch(')).toBe(false);
    expect(contracts.includes('supabase')).toBe(false);
    expect(contracts.includes('prompt')).toBe(false);
    expect(contracts.includes('tool-call')).toBe(false);
    expect(contracts.includes('ConversationCoreState')).toBe(false);
    expect(contracts.includes('stateUpdate')).toBe(false);
    expect(contracts.includes('processConversationTurn')).toBe(false);
    expect(contracts.includes('generateConversationReply')).toBe(false);

    expect(generate.includes('conversationalLayerContracts')).toBe(false);
    expect(processTurn.includes('conversationalLayerContracts')).toBe(false);
    expect(createPlan.includes('conversationalLayerContracts')).toBe(false);
    expect(index.includes('conversationalLayerContracts')).toBe(false);
  });

  it('requires ConversationalLayerInput to reference a readonly structured reply plan', () => {
    const plan = samplePlan();
    const objective: ConversationalObjective = {
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    };
    const input = createConversationalLayerInput(plan, objective);

    expect(input.plan).toBe(plan);
    expect(input.plan).toEqual({
      acknowledgements: ['Great — Brisbane.'],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    expectTypeOf<ConversationalLayerInput['plan']>().toEqualTypeOf<ConversationReplyPlan>();
    expectTypeOf(input.plan).toMatchTypeOf<ConversationReplyPlan>();
    expectTypeOf<ConversationalLayerInput['objective']>().toEqualTypeOf<
      ConversationalObjective | null
    >();
    expectTypeOf<ConversationalLayerInput>().not.toHaveProperty('state');
    expectTypeOf<ConversationalLayerInput>().not.toHaveProperty('stateUpdate');
    expectTypeOf<ConversationalLayerInput>().not.toHaveProperty('priority');
    expectTypeOf<ConversationalLayerInput>().not.toHaveProperty('eligibility');
  });

  it('limits ConversationalLayerOutput to conversational wording only', () => {
    const output: ConversationalLayerOutput = {
      wording: 'Where are you flying out of?',
    };

    expect(Object.keys(output)).toEqual(['wording']);
    expect(typeof output.wording).toBe('string');

    expectTypeOf<ConversationalLayerOutput>().toEqualTypeOf<{
      readonly wording: string;
    }>();
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('stateUpdate');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('priority');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('eligibility');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('approval');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('toolCall');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('booking');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('plan');
  });

  it('identifies ConversationalObjective from the plan without recalculating eligibility', () => {
    const cases: Array<{
      plan: ConversationReplyPlan;
      id: ConversationalObjective['id'];
      wording: string | null;
    }> = [
      {
        plan: samplePlan({ followUpQuestion: FOLLOW_UPS.destination }),
        id: 'destination',
        wording: FOLLOW_UPS.destination,
      },
      {
        plan: samplePlan({
          acknowledgements: [],
          followUpQuestion: FOLLOW_UPS.origin,
        }),
        id: 'origin',
        wording: FOLLOW_UPS.origin,
      },
      {
        plan: samplePlan({ followUpQuestion: FOLLOW_UPS.departureDate }),
        id: 'departureDate',
        wording: FOLLOW_UPS.departureDate,
      },
      {
        plan: samplePlan({ followUpQuestion: FOLLOW_UPS.returnDate }),
        id: 'returnDate',
        wording: FOLLOW_UPS.returnDate,
      },
      {
        plan: samplePlan({ followUpQuestion: FOLLOW_UPS.flightsAdultCount }),
        id: 'flightsAdultCount',
        wording: FOLLOW_UPS.flightsAdultCount,
      },
      {
        plan: samplePlan({
          followUpQuestion: FOLLOW_UPS.accommodationGuestCount,
        }),
        id: 'accommodationGuestCount',
        wording: FOLLOW_UPS.accommodationGuestCount,
      },
      {
        plan: samplePlan({ followUpQuestion: FOLLOW_UPS.activities }),
        id: 'activities',
        wording: FOLLOW_UPS.activities,
      },
      {
        plan: samplePlan({ followUpQuestion: FOLLOW_UPS.restaurants }),
        id: 'restaurants',
        wording: FOLLOW_UPS.restaurants,
      },
      {
        plan: samplePlan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
        }),
        id: 'neutralContinuation',
        wording: FOLLOW_UPS.neutralContinuation,
      },
      {
        plan: samplePlan({
          acknowledgements: [],
          followUpQuestion: null,
          messageInterpreted: false,
        }),
        id: 'none',
        wording: null,
      },
    ];

    for (const entry of cases) {
      const objective = identifyConversationalObjective(entry.plan);
      expect(objective.id, entry.id).toBe(entry.id);
      expect(objective.catalogueWording, entry.id).toBe(entry.wording);
      expect(objective).toEqual({
        id: entry.id,
        catalogueWording: entry.wording,
      });
    }

    expectTypeOf<ConversationalObjective>().toHaveProperty('id');
    expectTypeOf<ConversationalObjective>().toHaveProperty('catalogueWording');
    expectTypeOf<ConversationalObjective>().not.toHaveProperty('state');
    expectTypeOf<ConversationalObjective>().not.toHaveProperty('priority');
  });

  it('limits ConversationalStyleProfile to tone and phrasing preferences', () => {
    const profile: ConversationalStyleProfile = {
      id: 'warm-consultant',
      tone: 'warm',
      phrasingPreferences: ['Australian English', 'premium travel consultant'],
    };

    expect(Object.keys(profile).sort()).toEqual([
      'id',
      'phrasingPreferences',
      'tone',
    ]);
    expect(profile.tone).toBe('warm');

    expectTypeOf<ConversationalStyleProfile>().toHaveProperty('id');
    expectTypeOf<ConversationalStyleProfile>().toHaveProperty('tone');
    expectTypeOf<ConversationalStyleProfile>().not.toHaveProperty('stateUpdate');
    expectTypeOf<ConversationalStyleProfile>().not.toHaveProperty(
      'destination',
    );
    expectTypeOf<ConversationalStyleProfile>().not.toHaveProperty(
      'flightsRequested',
    );
    expectTypeOf<ConversationalStyleProfile>().not.toHaveProperty('approval');
    expectTypeOf<ConversationalStyleProfile>().not.toHaveProperty('toolCall');
    expectTypeOf<ConversationalStyleProfile>().not.toHaveProperty('booking');
  });

  it('builds layer input from an assembled plan without changing the plan', () => {
    const plan = assembleConversationReplyPlan({
      acknowledgement: 'Great — Brisbane.',
      followUpQuestion: FOLLOW_UPS.origin,
      continuationPrompt: null,
      messageInterpreted: true,
    });
    const planBefore = structuredClone(plan);
    const objective: ConversationalObjective = {
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    };
    const style: ConversationalStyleProfile = {
      id: 'concise',
      tone: 'concise',
    };

    const input = createConversationalLayerInput(plan, objective, style);

    expect(input.plan).toBe(plan);
    expect(input.plan).toEqual(planBefore);
    expect(input.objective).toEqual(objective);
    expect(input.styleProfile).toEqual(style);

    // Output remains wording-only; contracts do not produce control side effects.
    const output: ConversationalLayerOutput = {
      wording: 'Which city will you be departing from?',
    };
    expect(output).toEqual({
      wording: 'Which city will you be departing from?',
    });
    expect(plan).toEqual(planBefore);
  });

  it('preserves a concrete objective and accepts null without inventing "none"', () => {
    const planWithObjective = samplePlan();
    const concrete: ConversationalObjective = {
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    };
    const style: ConversationalStyleProfile = {
      id: 'warm-consultant',
      tone: 'warm',
    };

    const withObjective = createConversationalLayerInput(
      planWithObjective,
      concrete,
      style,
    );
    expect(withObjective.plan).toBe(planWithObjective);
    expect(withObjective.objective).toBe(concrete);
    expect(withObjective.objective).toEqual({
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    });
    expect(withObjective.styleProfile).toBe(style);
    expect(Object.isFrozen(withObjective)).toBe(true);

    const emptyPlan = samplePlan({
      acknowledgements: [],
      followUpQuestion: null,
      messageInterpreted: false,
    });
    const withNull = createConversationalLayerInput(emptyPlan, null);
    expect(withNull.plan).toBe(emptyPlan);
    expect(withNull.objective).toBeNull();
    expect(withNull.objective).not.toEqual({
      id: 'none',
      catalogueWording: null,
    });
    expect(withNull.styleProfile).toBeUndefined();
    expect(Object.isFrozen(withNull)).toBe(true);

    expectTypeOf(withNull.objective).toEqualTypeOf<ConversationalObjective | null>();
  });

  it('leaves the existing reply-generation path unchanged', () => {
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    expect(generate).toMatch(/createConversationReplyPlan\(/);
    expect(generate).toMatch(/renderConversationReplyPlan\(/);
    expect(generate.includes('createConversationalLayerInput')).toBe(false);
    expect(generate.includes('ConversationalLayerOutput')).toBe(false);
    expect(generate.includes('identifyConversationalObjective')).toBe(false);
  });
});
