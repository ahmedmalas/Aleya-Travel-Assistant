import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { compareBaselineConversationalReplyPlan } from '../compareBaselineConversationalReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { evaluateBaselineConversationalReplyPlan } from '../evaluateBaselineConversationalReplyPlan';
import { evaluateBaselineConversationalReplyPlanOutcome } from '../evaluateBaselineConversationalReplyPlanOutcome';
import * as baselineModule from '../generateBaselineConversationalReply';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { renderConversationReplyPlanByIntegrationMode } from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 14M — controlled runtime activation readiness audit.
 *
 * Audit-only characterisation of the Phase 14 integration architecture.
 * Does not activate the baseline conversational branch in production.
 */

const ROOT = process.cwd();
const CONVERSATION_CORE_DIR = resolve(ROOT, 'src/features/conversation-core');
const INDEX_SOURCE = resolve(CONVERSATION_CORE_DIR, 'index.ts');
const PROCESS_TURN_SOURCE = resolve(CONVERSATION_CORE_DIR, 'processTurn.ts');
const INTEGRATED_REPLY_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'generateIntegratedConversationReply.ts',
);
const GENERATE_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'generateConversationReply.ts',
);
const SEAM_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'renderIntegratedConversationReplyPlan.ts',
);
const MODE_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'renderConversationReplyPlanByIntegrationMode.ts',
);
const CREATE_PLAN_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'createConversationReplyPlan.ts',
);

const PRODUCTION_PATH_SOURCES = [
  PROCESS_TURN_SOURCE,
  INTEGRATED_REPLY_SOURCE,
  GENERATE_SOURCE,
  SEAM_SOURCE,
  MODE_SOURCE,
] as const;

const EVALUATION_ONLY_MARKERS = [
  'evaluateBaselineConversationalReplyPlan',
  'evaluateBaselineConversationalReplyPlanOutcome',
  'compareBaselineConversationalReplyPlan',
  'BaselineConversationalComparisonStatus',
] as const;

const RUNTIME_SELECTION_MARKERS = [
  'process.env',
  'import.meta.env',
  'featureFlag',
  'Math.random',
  'percentage',
  'URLSearchParams',
  'localStorage',
  'sessionStorage',
  'console.',
  'telemetry',
  'analytics',
  'async ',
  'await ',
  'Promise',
] as const;

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function plan(
  overrides: Partial<ConversationReplyPlan> = {},
): ConversationReplyPlan {
  return {
    acknowledgements: [],
    acknowledgementEvent: null,
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-14m',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

describe('phase 14M — controlled runtime activation readiness audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proves production selection is statically baseline-conversational with no mode injection', () => {
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const integrated = readFileSync(INTEGRATED_REPLY_SOURCE, 'utf8');
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const modeDriven = readFileSync(MODE_SOURCE, 'utf8');

    expect(processTurn).toMatch(/generateIntegratedConversationReply\(/);
    expect(processTurn).not.toMatch(/generateConversationReply\(/);
    expect(processTurn.includes('mode:')).toBe(false);
    expect(processTurn.includes('baseline-conversational')).toBe(false);

    expect(integrated).toMatch(
      /type ConversationReplyIntegrationMode = 'deterministic'/,
    );
    expect(integrated).toMatch(
      /const mode: ConversationReplyIntegrationMode = 'deterministic'/,
    );
    expect(integrated.includes('baseline-conversational')).toBe(false);
    expect(integrated.includes('mode?:')).toBe(false);

    expect(generate).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(generate.includes('mode:')).toBe(false);
    expect(generate.includes('baseline-conversational')).toBe(false);

    expect(seam).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(seam).not.toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );
    expect(seam).toMatch(
      /export function renderIntegratedConversationReplyPlan\(\s*input: RenderIntegratedConversationReplyPlanInput,\s*\): string/,
    );
    expect(seam.includes('mode?:')).toBe(false);
    expect(seam.includes('input.mode')).toBe(false);

    expect(modeDriven).toMatch(
      /export type ConversationReplyPlanIntegrationMode =\s*\|\s*'deterministic'\s*\|\s*'baseline-conversational'/,
    );
    expect(modeDriven).toMatch(/switch \(input\.mode\)/);
    expect(modeDriven.match(/case '/g)?.length).toBe(2);
    expect(modeDriven).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );
    expect(modeDriven).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);\s*\} catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );
  });

  it('proves completed-plan ownership remains with the deterministic engine', () => {
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    const createPlan = readFileSync(CREATE_PLAN_SOURCE, 'utf8');
    const modeDriven = readFileSync(MODE_SOURCE, 'utf8');
    const seam = readFileSync(SEAM_SOURCE, 'utf8');

    expect(generate).toMatch(/classifyConversationStateChange\(/);
    expect(generate).toMatch(/createConversationReplyPlan\(/);
    expect(createPlan).toMatch(/selectConversationReplyComponents\(/);
    expect(createPlan).toMatch(/assembleConversationReplyPlan\(/);

    expect(seam.includes('classifyConversationStateChange')).toBe(false);
    expect(seam.includes('createConversationReplyPlan')).toBe(false);
    expect(seam.includes('assembleConversationReplyPlan(')).toBe(false);
    expect(seam.includes('selectConversationReplyComponents')).toBe(false);

    expect(modeDriven.includes('classifyConversationStateChange')).toBe(false);
    expect(modeDriven.includes('createConversationReplyPlan')).toBe(false);
    expect(modeDriven.includes('assembleConversationReplyPlan(')).toBe(false);
    expect(modeDriven.includes('selectConversationReplyComponents')).toBe(
      false,
    );
    expect(modeDriven).toMatch(
      /plan: Readonly<ConversationReplyPlan>/,
    );
  });

  it('proves successful baseline parity, fallback, same-plan use, and immutability', () => {
    const cases: Array<{ label: string; replyPlan: ConversationReplyPlan }> = [
      {
        label: 'acknowledgement + follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
      },
      {
        label: 'neutral continuation',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      },
      {
        label: 'capability enable',
        replyPlan: plan({
          acknowledgements: [ACKS.addedCapabilities('flights')],
      acknowledgementEvent: null,
          followUpQuestion: FOLLOW_UPS.flightsAdultCount,
          messageInterpreted: true,
        }),
      },
      {
        label: 'empty',
        replyPlan: plan(),
      },
    ];

    for (const entry of cases) {
      const frozen = Object.freeze({
        ...entry.replyPlan,
        acknowledgements: Object.freeze([...entry.replyPlan.acknowledgements]),
      });
      const before = structuredClone(frozen);
      const deterministic = renderConversationReplyPlan(frozen);
      const viaProduction = renderIntegratedConversationReplyPlan({
        plan: frozen,
      });
      const viaBaselineMode = renderConversationReplyPlanByIntegrationMode({
        plan: frozen,
        mode: 'baseline-conversational',
      });
      const viaEvaluate = evaluateBaselineConversationalReplyPlan({
        plan: frozen,
      });
      const comparison = compareBaselineConversationalReplyPlan({
        plan: frozen,
      });

      const expected = expectedActivatedBaselineReply(frozen);
      const diverges = expected !== deterministic;
      expect(viaProduction, entry.label).toBe(expected);
      expect(viaBaselineMode, `${entry.label} / baseline mode`).toBe(expected);
      expect(viaEvaluate, `${entry.label} / evaluate`).toBe(expected);
      expect(comparison.matchesDeterministic, entry.label).toBe(!diverges);
      expect(comparison.status, entry.label).toBe(
        diverges ? 'different' : 'identical',
      );
      expect(frozen, `${entry.label} / unchanged`).toEqual(before);
      expect(Object.isFrozen(frozen), entry.label).toBe(true);
    }

    const failurePlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze([ACKS.origin('Sydney')]),
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const failureBefore = structuredClone(failurePlan);
    const failureExpected = renderConversationReplyPlan(failurePlan);

    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      expect(receivedPlan).toBe(failurePlan);
      throw new Error('forced-baseline-failure:14m');
    });

    const fallbackReply = renderConversationReplyPlanByIntegrationMode({
      plan: failurePlan,
      mode: 'baseline-conversational',
    });
    const fallbackOutcome = evaluateBaselineConversationalReplyPlanOutcome({
      plan: failurePlan,
    });
    const fallbackComparison = compareBaselineConversationalReplyPlan({
      plan: failurePlan,
    });

    expect(fallbackReply).toBe(failureExpected);
    expect(fallbackOutcome).toEqual({
      reply: failureExpected,
      usedFallback: true,
    });
    expect(fallbackComparison.status).toBe('fallback');
    expect(fallbackComparison.matchesDeterministic).toBe(true);
    expect(failurePlan).toEqual(failureBefore);
  });

  it('proves no runtime selection mechanisms on the authoritative production path', () => {
    for (const sourcePath of PRODUCTION_PATH_SOURCES) {
      const source = readFileSync(sourcePath, 'utf8');
      for (const marker of RUNTIME_SELECTION_MARKERS) {
        expect(
          source.includes(marker),
          `${sourcePath} must not contain ${marker}`,
        ).toBe(false);
      }
    }

    const productionReply = generateConversationReply({
      message: 'go to Brisbane',
      previousState: createState(),
      state: createState({ destination: 'Brisbane' }),
    });
    expect(productionReply).toBe(
      `${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`,
    );
    expect(
      renderIntegratedConversationReplyPlan({
        plan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
      acknowledgementEvent: null,
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
      }),
    ).toBe(productionReply);
  });

  it('proves evaluation-only helpers stay out of production modules and public barrels', () => {
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    for (const marker of EVALUATION_ONLY_MARKERS) {
      expect(index.includes(marker), `barrel must not expose ${marker}`).toBe(
        false,
      );
    }

    expect(index).toMatch(/processConversationTurn/);
    expect(index).toMatch(/createInitialConversationCoreState/);
    expect(index.includes('generateConversationReply')).toBe(false);
    expect(index.includes('renderIntegratedConversationReplyPlan')).toBe(false);
    expect(index.includes('renderConversationReplyPlanByIntegrationMode')).toBe(
      false,
    );
    expect(index.includes('generateBaselineConversationalReply')).toBe(false);

    for (const sourcePath of [
      PROCESS_TURN_SOURCE,
      INTEGRATED_REPLY_SOURCE,
      GENERATE_SOURCE,
      SEAM_SOURCE,
    ] as const) {
      const source = readFileSync(sourcePath, 'utf8');
      for (const marker of EVALUATION_ONLY_MARKERS) {
        expect(
          source.includes(marker),
          `${sourcePath} must not import ${marker}`,
        ).toBe(false);
      }
    }

    for (const name of readdirSync(CONVERSATION_CORE_DIR)) {
      if (!name.endsWith('.ts')) continue;
      if (
        name === 'evaluateBaselineConversationalReplyPlan.ts' ||
        name === 'evaluateBaselineConversationalReplyPlanOutcome.ts' ||
        name === 'compareBaselineConversationalReplyPlan.ts'
      ) {
        continue;
      }
      if (
        name === 'renderConversationReplyPlanByIntegrationMode.ts' ||
        name === 'renderIntegratedConversationReplyPlan.ts' ||
        name === 'generateConversationReply.ts' ||
        name === 'generateIntegratedConversationReply.ts' ||
        name === 'processTurn.ts' ||
        name === 'index.ts'
      ) {
        const contents = readFileSync(
          resolve(CONVERSATION_CORE_DIR, name),
          'utf8',
        );
        for (const marker of EVALUATION_ONLY_MARKERS) {
          expect(
            contents.includes(marker),
            `${name} must not reference ${marker}`,
          ).toBe(false);
        }
      }
    }
  });
});
