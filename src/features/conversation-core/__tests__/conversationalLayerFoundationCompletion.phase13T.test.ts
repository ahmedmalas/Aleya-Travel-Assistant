import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createConversationalLayerInput,
  type ConversationalLayerInput,
  type ConversationalLayerOutput,
  type ConversationalLayerRenderer,
  type ConversationalObjective,
  type ConversationalStyleProfile,
} from '../conversationalLayerContracts';
import {
  createConversationalRendererRegistry,
  selectConversationalLayerRenderer,
} from '../conversationalRendererRegistry';
import { createBaselineConversationalRendererRegistry } from '../createBaselineConversationalRendererRegistry';
import { executeBaselineConversationalRenderer } from '../executeBaselineConversationalRenderer';
import { executeConversationalLayerRenderer } from '../executeConversationalLayerRenderer';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { invokeConversationalLayerRenderer } from '../invokeConversationalLayerRenderer';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_PROFILES,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { renderBaselineConversationalReplyPlan } from '../renderBaselineConversationalReplyPlan';
import { selectConversationalObjective } from '../selectConversationalObjective';

/**
 * Phase 13T — conversational layer foundation completion audit.
 *
 * Final characterization that Phase 13 is structurally complete, coherent,
 * deterministic, immutable, isolated from production runtime, and ready for a
 * future separately approved integration phase. Adds no production behaviour.
 */

const ROOT = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function srcExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

const PHASE13_MODULES = [
  'src/features/conversation-core/conversationalLayerContracts.ts',
  'src/features/conversation-core/referenceConversationalStyleProfiles.ts',
  'src/features/conversation-core/selectConversationalObjective.ts',
  'src/features/conversation-core/buildConversationalLayerInput.ts',
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
  'src/features/conversation-core/invokeConversationalLayerRenderer.ts',
  'src/features/conversation-core/conversationalRendererRegistry.ts',
  'src/features/conversation-core/executeConversationalLayerRenderer.ts',
  'src/features/conversation-core/createBaselineConversationalRendererRegistry.ts',
  'src/features/conversation-core/executeBaselineConversationalRenderer.ts',
  'src/features/conversation-core/renderBaselineConversationalReplyPlan.ts',
  'src/features/conversation-core/generateBaselineConversationalReply.ts',
] as const;

const PRODUCTION_PIPELINE = [
  'src/features/conversation-core/generateConversationReply.ts',
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
  'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
  'src/features/conversation-core/processTurn.ts',
  'src/features/conversation-core/selectConversationReplyComponents.ts',
  'src/features/conversation-core/assembleConversationReplyPlan.ts',
  'src/features/conversation-core/createConversationReplyPlan.ts',
  'src/features/conversation-core/index.ts',
] as const;

const EXPERIMENTAL_MARKERS = [
  'generateBaselineConversationalReply',
  'renderBaselineConversationalReplyPlan',
  'executeBaselineConversationalRenderer',
  'buildConversationalLayerInput',
  'renderBaselineConversationalLayer',
  'ConversationalLayerInput',
  'ConversationalLayerRenderer',
  'conversationalLayerContracts',
  'referenceConversationalStyleProfiles',
] as const;

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const STYLE_PROFILES = [
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
] as const;

function plan(
  overrides: Partial<ConversationReplyPlan> = {},
): ConversationReplyPlan {
  return {
    acknowledgements: [],
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

describe('phase 13T — conversational layer foundation completion', () => {
  it('proves every required Phase 13 production module and contract exists', () => {
    for (const modulePath of PHASE13_MODULES) {
      expect(srcExists(modulePath), modulePath).toBe(true);
    }

    expectTypeOf<ConversationalLayerInput>().toHaveProperty('plan');
    expectTypeOf<ConversationalLayerInput>().toHaveProperty('objective');
    expectTypeOf<ConversationalLayerInput['objective']>().toEqualTypeOf<
      ConversationalObjective | null
    >();
    expectTypeOf<ConversationalLayerInput>().toHaveProperty('styleProfile');

    expectTypeOf<ConversationalLayerOutput>().toEqualTypeOf<{
      readonly wording: string;
    }>();
    expectTypeOf<ConversationalObjective>().toHaveProperty('id');
    expectTypeOf<ConversationalObjective>().toHaveProperty('catalogueWording');
    expectTypeOf<ConversationalStyleProfile>().toHaveProperty('id');
    expectTypeOf<ConversationalStyleProfile>().toHaveProperty('tone');
    expectTypeOf<ConversationalLayerRenderer>().returns.toEqualTypeOf<ConversationalLayerOutput>();

    expect(REFERENCE_CONVERSATIONAL_STYLE_PROFILES).toHaveLength(3);
    expect(REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL.id).toBe('professional');
    expect(REFERENCE_CONVERSATIONAL_STYLE_WARM.id).toBe('warm');
    expect(REFERENCE_CONVERSATIONAL_STYLE_LUXURY.id).toBe('luxury');

    expect(typeof selectConversationalObjective).toBe('function');
    expect(typeof buildConversationalLayerInput).toBe('function');
    expect(typeof renderBaselineConversationalLayer).toBe('function');
    expect(typeof invokeConversationalLayerRenderer).toBe('function');
    expect(typeof createConversationalRendererRegistry).toBe('function');
    expect(typeof selectConversationalLayerRenderer).toBe('function');
    expect(typeof executeConversationalLayerRenderer).toBe('function');
    expect(typeof createBaselineConversationalRendererRegistry).toBe('function');
    expect(typeof executeBaselineConversationalRenderer).toBe('function');
    expect(typeof renderBaselineConversationalReplyPlan).toBe('function');
    expect(typeof generateBaselineConversationalReply).toBe('function');
  });

  it('proves the composition chain and one-responsibility ownership for each layer', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.destination('Brisbane')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });

    const input = buildConversationalLayerInput(replyPlan);
    expect(input.plan).toBe(replyPlan);
    expect(input.objective).toEqual({
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    });
    expect(input.styleProfile).toBeUndefined();

    const viaBaselineExecute = executeBaselineConversationalRenderer(input);
    const registry = createBaselineConversationalRendererRegistry();
    expect(Object.keys(registry)).toEqual(['baseline']);
    expect(selectConversationalLayerRenderer(registry, 'baseline')).toBe(
      renderBaselineConversationalLayer,
    );

    const viaGenericExecute = executeConversationalLayerRenderer(
      registry,
      'baseline',
      input,
    );
    expect(viaGenericExecute).toEqual(viaBaselineExecute);

    const viaInvoke = invokeConversationalLayerRenderer(
      renderBaselineConversationalLayer,
      input,
    );
    expect(viaInvoke).toEqual(viaBaselineExecute);

    const viaRenderer = renderBaselineConversationalLayer(input);
    expect(viaRenderer).toEqual(viaBaselineExecute);
    expect(Object.keys(viaRenderer)).toEqual(['wording']);

    const viaAdapter = renderBaselineConversationalReplyPlan(replyPlan);
    expect(viaAdapter).toEqual(viaBaselineExecute);

    const wording = generateBaselineConversationalReply(replyPlan);
    expect(wording).toBe(viaBaselineExecute.wording);
    expect(wording).toBe(renderConversationReplyPlan(replyPlan));

    // Layer ownership — each module owns one step; no bypass imports.
    expect(readSrc(PHASE13_MODULES[11]!)).toMatch(
      /renderBaselineConversationalReplyPlan\(plan, styleProfile\)\.wording/,
    );
    expect(readSrc(PHASE13_MODULES[10]!)).toMatch(/buildConversationalLayerInput/);
    expect(readSrc(PHASE13_MODULES[10]!)).toMatch(
      /executeBaselineConversationalRenderer/,
    );
    expect(readSrc(PHASE13_MODULES[9]!)).toMatch(
      /createBaselineConversationalRendererRegistry/,
    );
    expect(readSrc(PHASE13_MODULES[9]!)).toMatch(
      /executeConversationalLayerRenderer/,
    );
    expect(readSrc(PHASE13_MODULES[7]!)).toMatch(/selectConversationalLayerRenderer/);
    expect(readSrc(PHASE13_MODULES[7]!)).toMatch(/invokeConversationalLayerRenderer/);
    expect(readSrc(PHASE13_MODULES[5]!)).toMatch(/return renderer\(input\)/);
    expect(readSrc(PHASE13_MODULES[4]!)).toMatch(/renderConversationReplyPlan\(input\.plan\)/);
  });

  it('proves deterministic parity with and without reference style profiles', () => {
    const cases: ConversationReplyPlan[] = [
      plan({
        acknowledgements: [ACKS.destination('Brisbane')],
        followUpQuestion: FOLLOW_UPS.destination,
        messageInterpreted: true,
      }),
      plan({
        acknowledgements: [ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
      plan({
        followUpQuestion: FOLLOW_UPS.activities,
        messageInterpreted: true,
      }),
      plan({
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
      plan({
        acknowledgements: [ACKS.genericTravelFieldChange],
        followUpQuestion: null,
        messageInterpreted: true,
      }),
      plan(),
    ];

    for (const replyPlan of cases) {
      const deterministic = renderConversationReplyPlan(replyPlan);
      expect(generateBaselineConversationalReply(replyPlan)).toBe(deterministic);

      for (const style of STYLE_PROFILES) {
        expect(generateBaselineConversationalReply(replyPlan, style)).toBe(
          deterministic,
        );
      }

      const nullObjectivePlan = plan({
        acknowledgements: replyPlan.acknowledgements,
        followUpQuestion: null,
        messageInterpreted: replyPlan.messageInterpreted,
      });
      if (replyPlan.followUpQuestion === null) {
        expect(selectConversationalObjective(nullObjectivePlan)).toBeNull();
        expect(buildConversationalLayerInput(nullObjectivePlan).objective).toBeNull();
        expect(generateBaselineConversationalReply(nullObjectivePlan)).toBe(
          renderConversationReplyPlan(nullObjectivePlan),
        );
      }
    }
  });

  it('proves immutability of plans, inputs, styles, and registries under execution', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze([ACKS.destination('Melbourne')]),
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    const style = REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL;
    const planBefore = structuredClone(replyPlan);
    const styleBefore = structuredClone(style);

    const input = Object.freeze(
      buildConversationalLayerInput(replyPlan, style),
    );
    const inputBefore = structuredClone(input);
    const registry = createBaselineConversationalRendererRegistry();
    const registryBefore = { ...registry };

    const first = generateBaselineConversationalReply(replyPlan, style);
    const second = generateBaselineConversationalReply(replyPlan, style);
    const third = executeBaselineConversationalRenderer(input).wording;
    const fourth = renderBaselineConversationalReplyPlan(replyPlan, style).wording;

    expect(first).toBe(renderConversationReplyPlan(replyPlan));
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(fourth).toBe(first);

    expect(replyPlan).toEqual(planBefore);
    expect(style).toEqual(styleBefore);
    expect(input).toEqual(inputBefore);
    expect(registry).toEqual(registryBefore);
    expect(Object.isFrozen(replyPlan)).toBe(true);
    expect(Object.isFrozen(style)).toBe(true);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(registry)).toBe(true);

    expect(() => {
      (registry as { baseline?: ConversationalLayerRenderer }).baseline = () => ({
        wording: 'mutated',
      });
    }).toThrow();
    expect(registry.baseline).toBe(renderBaselineConversationalLayer);
  });

  it('proves production runtime isolation and barrel non-export of the experimental stack', () => {
    for (const relativePath of PRODUCTION_PIPELINE) {
      const source = readSrc(relativePath);
      if (
        relativePath ===
        'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts'
      ) {
        // Phase 14H: unselected baseline import is allowed on the mode-driven
        // renderer; production wrapper selection stays deterministic.
        expect(source).toMatch(/switch \(input\.mode\)/);
        expect(source.includes('generateBaselineConversationalReply')).toBe(
          true,
        );
        for (const marker of EXPERIMENTAL_MARKERS) {
          if (marker === 'generateBaselineConversationalReply') continue;
          expect(
            source.includes(marker),
            `${relativePath} must not reference ${marker}`,
          ).toBe(false);
        }
        continue;
      }
      for (const marker of EXPERIMENTAL_MARKERS) {
        expect(
          source.includes(marker),
          `${relativePath} must not reference ${marker}`,
        ).toBe(false);
      }
    }

    const index = readSrc('src/features/conversation-core/index.ts');
    expect(index).toMatch(/processConversationTurn/);
    expect(index).toMatch(/createInitialConversationCoreState/);
    expect(index.includes("from './generateBaselineConversationalReply'")).toBe(
      false,
    );
    expect(index.includes("from './conversationalLayerContracts'")).toBe(false);
    expect(index.includes("from './referenceConversationalStyleProfiles'")).toBe(
      false,
    );
    expect(
      index.includes("from './renderConversationReplyPlanByIntegrationMode'"),
    ).toBe(false);
    expect(index.includes('evaluateBaselineConversationalReplyPlan')).toBe(
      false,
    );
    expect(
      index.includes("from './evaluateBaselineConversationalReplyPlan'"),
    ).toBe(false);

    // Phase 14J evaluation entry is isolated from the production pipeline.
    for (const relativePath of PRODUCTION_PIPELINE) {
      if (relativePath.endsWith('index.ts')) continue;
      expect(
        readSrc(relativePath).includes('evaluateBaselineConversationalReplyPlan'),
        `${relativePath} must not import the evaluation entry point`,
      ).toBe(false);
    }
  });

  it('proves the Phase 13 stack has no hidden AI/tool/API/memory/booking capability or automatic fallback wording', () => {
    const forbiddenExact = [
      'OpenAI',
      'Anthropic',
      'openai',
      'anthropic',
      'fetch(',
      'supabase',
      'createClient(',
      'vectorStore',
      'embedding',
      'toolCall',
      'tool_call',
      'executeTool',
      'bookingAction',
      'recommendationEngine',
      'autoSelectRenderer',
      'defaultRenderer',
    ] as const;

    for (const modulePath of PHASE13_MODULES) {
      const source = readSrc(modulePath);
      for (const token of forbiddenExact) {
        expect(
          source.includes(token),
          `${modulePath} must not contain ${token}`,
        ).toBe(false);
      }
      expect(source.includes('import('), modulePath).toBe(false);
      expect(source.includes('require('), modulePath).toBe(false);
    }

    // Missing baseline registration fails explicitly — no alternate wording path.
    const executeBaseline = readSrc(
      'src/features/conversation-core/executeBaselineConversationalRenderer.ts',
    );
    expect(executeBaseline).toMatch(/throw new Error/);
    expect(executeBaseline.includes('renderConversationReplyPlan')).toBe(false);
    expect(executeBaseline.includes("wording: '")).toBe(false);

    // Unknown renderer id returns null; no silent substitute renderer.
    const empty = createConversationalRendererRegistry({});
    const sampleInput = createConversationalLayerInput(plan(), null);
    expect(
      executeConversationalLayerRenderer(empty, 'baseline', sampleInput),
    ).toBeNull();
  });

  it('characterizes ownership boundaries and proves baseline performs no tone/phrasing transformation', () => {
    const architecture = readSrc(
      'docs/architecture/travel-consultant-layer.md',
    );
    expect(architecture).toMatch(/Responsibilities of the deterministic engine/);
    expect(architecture).toMatch(/Authoritative travel state/);
    expect(architecture).toMatch(/State transitions/);
    expect(architecture).toMatch(/Follow-up priority and eligibility/);
    expect(architecture).toMatch(/Required conversational objective/);
    expect(architecture).toMatch(/Structured plan assembly/);
    expect(architecture).toMatch(/Responsibilities of the conversational layer/);
    expect(architecture).toMatch(/tone and formality/);
    expect(architecture).toMatch(/phrasing and natural dialogue variation/);
    expect(architecture).toMatch(/empathy and conversational warmth/);
    expect(architecture).toMatch(/conversation repair/);

    const styleDoc = readSrc('docs/architecture/conversation-style-interface.md');
    expect(styleDoc).toMatch(/Priority \/ eligibility \| Engine-only/);
    expect(styleDoc).toMatch(/Wording \/ tone \| Profile-specific/);

    // Current baseline implementation: no transformation — style ignored,
    // wording equals authoritative deterministic renderer exactly.
    const replyPlan = plan({
      acknowledgements: [ACKS.destination('Brisbane')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const deterministic = renderConversationReplyPlan(replyPlan);
    const baselineSource = readSrc(
      'src/features/conversation-core/renderBaselineConversationalLayer.ts',
    );
    expect(baselineSource).toMatch(
      /wording:\s*renderConversationReplyPlan\(input\.plan\)/,
    );
    expect(baselineSource.includes('styleProfile')).toBe(true);
    expect(baselineSource.includes('input.styleProfile')).toBe(false);
    expect(baselineSource.includes('input.objective')).toBe(false);
    expect(baselineSource.includes('empathy')).toBe(false);
    expect(baselineSource.includes('rephras')).toBe(false);
    expect(baselineSource.includes('tone')).toBe(false);

    for (const style of [undefined, ...STYLE_PROFILES]) {
      const wording =
        style === undefined
          ? generateBaselineConversationalReply(replyPlan)
          : generateBaselineConversationalReply(replyPlan, style);
      expect(wording).toBe(deterministic);
      expect(wording).toBe(`Great — Brisbane.\n${FOLLOW_UPS.origin}`);
    }
  });
});
