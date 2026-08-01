import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import * as baselineModule from '../generateBaselineConversationalReply';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import * as generateModule from '../generateConversationReply';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { renderConversationReplyPlanByIntegrationMode } from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 20B — freeze production conversational integration.
 *
 * Proves one seam, one active mode, successful-render vs fallback contracts,
 * and expression purity. Does not re-wire production or change wording.
 */

const ROOT = process.cwd();
const CORE = resolve(ROOT, 'src/features/conversation-core');
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const SELECTABLE_QUESTIONS = Object.values(FOLLOW_UPS);

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
      conversationId: 'conversation-20b',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function assertSingleSelectedQuestion(reply: string): void {
  expect(
    SELECTABLE_QUESTIONS.filter((question) => reply.includes(question)).length,
  ).toBeLessThanOrEqual(1);
}

function productionTurn(
  message: string,
  seed: Partial<ConversationCoreState> = {},
  stateUpdate?: ConversationCoreState extends never
    ? never
    : Record<string, unknown>,
) {
  const previous = createState(seed);
  const previousSnapshot = structuredClone(previous);
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-20b',
    assistantEntryId: 'assistant-20b',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    ...(stateUpdate ? { stateUpdate } : {}),
  });
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return {
    previous,
    previousSnapshot,
    result,
    classification,
    plan,
    expected: expectedActivatedBaselineReply(plan),
    baseline: generateBaselineConversationalReply(plan),
    deterministic: renderConversationReplyPlan(plan),
  };
}

describe('Phase 20B — production conversational integration freeze', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('freezes exactly one production expression seam and one active mode', () => {
    const processTurn = readSrc(
      'src/features/conversation-core/processTurn.ts',
    );
    const integrated = readSrc(
      'src/features/conversation-core/generateIntegratedConversationReply.ts',
    );
    const generate = readSrc(
      'src/features/conversation-core/generateConversationReply.ts',
    );
    const seam = readSrc(
      'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
    );
    const modeDriven = readSrc(
      'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
    );
    const index = readSrc('src/features/conversation-core/index.ts');
    const freezeDoc = readSrc(
      'docs/conversation-engine/phase20B-production-conversational-integration-freeze.md',
    );

    // Sole turn → reply routing.
    expect(processTurn).toMatch(/generateIntegratedConversationReply\(/);
    expect(processTurn.match(/generateIntegratedConversationReply\(/g)?.length).toBe(
      1,
    );
    expect(processTurn).not.toMatch(/renderIntegratedConversationReplyPlan/);
    expect(processTurn).not.toMatch(/generateBaselineConversationalReply/);
    expect(processTurn).not.toMatch(/renderConversationReplyPlan\(/);

    expect(integrated).toMatch(/return generateConversationReply\(input\)/);
    expect(integrated.match(/generateConversationReply\(/g)?.length).toBe(1);
    expect(integrated).not.toMatch(/baseline-conversational/);
    expect(integrated).not.toMatch(/generateBaselineConversationalReply/);
    expect(integrated).not.toMatch(/renderConversationReplyPlan\(/);

    // Orchestration owner calls the expression seam once.
    expect(generate).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(
      generate.match(/renderIntegratedConversationReplyPlan\(/g)?.length,
    ).toBe(1);
    expect(generate).not.toMatch(/generateBaselineConversationalReply/);
    expect(generate).not.toMatch(/baseline-conversational/);

    // Active mode selected once at the expression seam.
    expect(seam).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(
      seam.match(
        /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/g,
      )?.length,
    ).toBe(1);
    expect(seam).not.toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'deterministic'/,
    );
    expect(seam).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode,\s*\}\)/,
    );

    expect(modeDriven).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);\s*\} catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );
    expect(modeDriven).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );

    // Minimal public surface.
    expect(index).toMatch(/processConversationTurn/);
    expect(index).not.toMatch(/generateConversationReply/);
    expect(index).not.toMatch(/renderIntegratedConversationReplyPlan/);
    expect(index).not.toMatch(/generateBaselineConversationalReply/);
    expect(index).not.toMatch(/renderConversationReplyPlan/);

    expect(freezeDoc).toContain('Phase 20B');
    expect(freezeDoc).toContain('sole production expression');
    expect(freezeDoc).toContain("'baseline-conversational'");
  });

  it('proves no production module bypasses the expression seam to call baseline helpers', () => {
    const productionFiles = readdirSync(CORE).filter(
      (name) => name.endsWith('.ts') && !name.startsWith('.'),
    );
    const allowedBaselineImporters = new Set([
      'generateBaselineConversationalReply.ts',
      'renderBaselineConversationalReplyPlan.ts',
      'renderConversationReplyPlanByIntegrationMode.ts',
      // Downstream expression stack (not turn routing).
      'executeBaselineConversationalRenderer.ts',
      'createBaselineConversationalRendererRegistry.ts',
      'executeConversationalLayerRenderer.ts',
      'renderBaselineConversationalLayer.ts',
      'buildConversationalLayerInput.ts',
      'selectConversationalObjective.ts',
      'invokeConversationalLayerRenderer.ts',
      'evaluateBaselineConversationalReplyPlan.ts',
      'compareBaselineConversationalReplyPlan.ts',
      'evaluateBaselineConversationalReplyPlanOutcome.ts',
    ]);

    for (const name of productionFiles) {
      const source = readFileSync(resolve(CORE, name), 'utf8');
      if (!source.includes('generateBaselineConversationalReply')) {
        continue;
      }
      if (name === 'generateBaselineConversationalReply.ts') {
        continue;
      }
      expect(
        allowedBaselineImporters.has(name) ||
          source.includes("from './generateBaselineConversationalReply'"),
        `${name} must not be a turn-routing bypass of baseline expression`,
      ).toBe(true);
      expect(
        ['processTurn.ts', 'generateIntegratedConversationReply.ts', 'generateConversationReply.ts'].includes(
          name,
        ),
      ).toBe(false);
    }

    // Deterministic renderer production call sites are only fallback/residual.
    const modeDriven = readSrc(
      'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
    );
    const baselineLayer = readSrc(
      'src/features/conversation-core/renderBaselineConversationalLayer.ts',
    );
    const processTurn = readSrc(
      'src/features/conversation-core/processTurn.ts',
    );
    const integrated = readSrc(
      'src/features/conversation-core/generateIntegratedConversationReply.ts',
    );
    expect(modeDriven.match(/renderConversationReplyPlan\(/g)?.length).toBe(2);
    expect(baselineLayer).toMatch(/renderConversationReplyPlan\(plan\)/);
    expect(processTurn).not.toMatch(/renderConversationReplyPlan\(/);
    expect(integrated).not.toMatch(/renderConversationReplyPlan\(/);
  });

  it('fallback is deterministic and does not run on successful conversational render', () => {
    const plan = createConversationReplyPlan({
      state: createState({ destination: 'Cairns' }),
      classification: classifyConversationStateChange(
        createState(),
        createState({ destination: 'Cairns' }),
      ),
    });
    const expected = expectedActivatedBaselineReply(plan);
    const deterministic = renderConversationReplyPlan(plan);

    const baselineSpy = vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    );
    const deterministicSpy = vi.spyOn(
      generateModule,
      'renderConversationReplyPlan',
    );

    const reply = renderIntegratedConversationReplyPlan({ plan });
    expect(reply).toBe(expected);
    expect(baselineSpy).toHaveBeenCalledTimes(1);
    expect(baselineSpy).toHaveBeenCalledWith(plan);
    // Successful baseline path must not invoke the deterministic fallback.
    expect(deterministicSpy).not.toHaveBeenCalled();
    void deterministic;
  });

  it('fallback runs only when conversational render throws under the existing contract', () => {
    const plan = createConversationReplyPlan({
      state: createState({ destination: 'Cairns' }),
      classification: classifyConversationStateChange(
        createState(),
        createState({ destination: 'Cairns' }),
      ),
    });
    const deterministicExpected = renderConversationReplyPlan(plan);

    vi.spyOn(baselineModule, 'generateBaselineConversationalReply').mockImplementation(
      () => {
        throw new Error('baseline unavailable');
      },
    );

    const reply = renderConversationReplyPlanByIntegrationMode({
      plan,
      mode: 'baseline-conversational',
    });
    expect(reply).toBe(deterministicExpected);

    const viaSeam = renderIntegratedConversationReplyPlan({ plan });
    expect(viaSeam).toBe(deterministicExpected);
  });

  it.each([
    {
      name: 'acknowledgement + follow-up',
      message: 'Cairns',
      seed: {},
    },
    {
      name: 'follow-up only',
      message: 'asdf qwerty',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'neutral continuation',
      message: '2 adults, 0 children and 0 infants',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'acknowledgement only / completed party destination',
      message: 'Cairns',
      seed: {
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-01',
        adultCount: 2,
        childCount: 0,
        infantCount: 0,
        flightsRequested: true,
      },
    },
    {
      name: 'uninterpreted message',
      message: 'hello there',
      seed: {},
    },
    {
      name: 'passenger progression',
      message: '2 adults',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'multi-passenger update',
      message: '2 adults and 1 child',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'zero child count',
      message: '0 children',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'zero infant count',
      message: '0 infants',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 0,
        infantCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'activity request',
      message: 'add beaches',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 0,
        infantCount: 0,
        activitiesRequested: true,
      },
    },
    {
      name: 'restaurant preference',
      message: 'italian food',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 0,
        infantCount: 0,
        restaurantsRequested: true,
      },
    },
    {
      name: 'field removal',
      message: 'Hello',
      seed: { destination: 'Cairns' },
      stateUpdate: { destination: null },
    },
  ])(
    '$name → one plan / one reply; baseline parity; pure render; single question',
    ({ message, seed, stateUpdate }) => {
      const t = productionTurn(message, seed, stateUpdate);
      expect(t.previous).toEqual(t.previousSnapshot);

      expect(t.result.reply).toBe(t.expected);
      expect(t.result.reply).toBe(t.baseline);
      expect(t.result.reply).toBe(
        renderIntegratedConversationReplyPlan({ plan: t.plan }),
      );
      expect(t.result.reply).toBe(
        generateConversationReply({
          message,
          state: t.result.state,
          previousState: t.previous,
        }),
      );

      expect(t.plan.acknowledgements.length).toBeLessThanOrEqual(1);
      assertSingleSelectedQuestion(t.result.reply);

      const planBefore = structuredClone(t.plan);
      const travelBefore = {
        adultCount: t.result.state.adultCount,
        childCount: t.result.state.childCount,
        infantCount: t.result.state.infantCount,
        destination: t.result.state.destination,
        restaurantPreference: t.result.state.restaurantPreference,
        beachesRequested: t.result.state.beachesRequested,
      };
      const again = generateBaselineConversationalReply(t.plan);
      const detAgain = renderConversationReplyPlan(t.plan);
      expect(again).toBe(t.result.reply);
      expect(t.plan).toEqual(planBefore);
      expect({
        adultCount: t.result.state.adultCount,
        childCount: t.result.state.childCount,
        infantCount: t.result.state.infantCount,
        destination: t.result.state.destination,
        restaurantPreference: t.result.state.restaurantPreference,
        beachesRequested: t.result.state.beachesRequested,
      }).toEqual(travelBefore);
      void detAgain;

      // Transcript + interpreted metadata are not altered by re-expression.
      expect(t.result.trace.messageInterpreted).toBe(
        t.classification.hasInterpretedChange,
      );
      expect(t.result.state.transcript.at(-1)?.message).toBe(t.result.reply);
      expect(t.result.reply).toBe(
        expectedActivatedBaselineReply(structuredClone(t.plan)),
      );
    },
  );

  it('expression selection does not change interpreted metadata for identical state', () => {
    const previous = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    const result = processConversationTurn({
      message: '2 adults',
      state: previous,
      userEntryId: 'user-20b-meta',
      assistantEntryId: 'assistant-20b-meta',
      userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    });
    const classification = classifyConversationStateChange(
      previous,
      result.state,
    );
    expect(result.trace.messageInterpreted).toBe(
      classification.hasInterpretedChange,
    );

    const plan = createConversationReplyPlan({
      state: result.state,
      classification,
    });
    const viaBaseline = generateBaselineConversationalReply(plan);
    const viaDeterministicMode = renderConversationReplyPlanByIntegrationMode({
      plan,
      mode: 'deterministic',
    });
    // Different expression modes may differ in wording, but classification /
    // interpreted flags are independent of expression selection.
    expect(result.trace.messageInterpreted).toBe(
      classification.hasInterpretedChange,
    );
    expect(result.state.adultCount).toBe(2);
    expect(viaBaseline).toBe(result.reply);
    expect(typeof viaDeterministicMode).toBe('string');
  });
});
