import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import * as baselineModule from '../generateBaselineConversationalReply';
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
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 14N — controlled baseline conversational runtime activation.
 *
 * Proves the production plan-level seam statically selects
 * `'baseline-conversational'` while ownership, fallback, and parity hold.
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

const BASELINE_MODE_CONST =
  /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/;
const DETERMINISTIC_MODE_CONST =
  /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/;

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

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-14n',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function turn(message: string, state: ConversationCoreState) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-14n',
    assistantEntryId: 'assistant-14n',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
  });
}

describe('phase 14N — controlled baseline conversational runtime activation', () => {
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

    expect(seam).toMatch(BASELINE_MODE_CONST);
    expect(seam).not.toMatch(DETERMINISTIC_MODE_CONST);
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

  it('proves processTurn reaches the baseline renderer while ownership stays deterministic', () => {
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
    expect(modeDriven).toMatch(/plan: Readonly<ConversationReplyPlan>/);

    const baselineSpy = vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    );
    const result = turn('go to Brisbane', createState());

    expect(result.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`,
    );
    expect(baselineSpy).toHaveBeenCalledTimes(1);
    const receivedPlan = baselineSpy.mock.calls[0]?.[0] as ConversationReplyPlan;
    expect(receivedPlan.acknowledgements).toEqual([
      ACKS.destination('Brisbane'),
    ]);
    expect(receivedPlan.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(receivedPlan.messageInterpreted).toBe(true);

    const viaGenerate = generateConversationReply({
      message: 'go to Brisbane',
      previousState: createState(),
      state: createState({ destination: 'Brisbane' }),
    });
    expect(viaGenerate).toBe(result.reply);
    expect(baselineSpy).toHaveBeenCalledTimes(2);
  });

  it('proves parity across reply shapes, forced fallback, same-plan use, and immutability', () => {
    const cases: Array<{ label: string; replyPlan: ConversationReplyPlan }> = [
      {
        label: 'acknowledgement-only',
        replyPlan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: null,
          messageInterpreted: true,
        }),
      },
      {
        label: 'follow-up-only',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.activities,
          messageInterpreted: true,
        }),
      },
      {
        label: 'acknowledgement plus follow-up',
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
          followUpQuestion: FOLLOW_UPS.flightsAdultCount,
          messageInterpreted: true,
        }),
      },
      {
        label: 'capability disable',
        replyPlan: plan({
          acknowledgements: [ACKS.removedCapabilities('flights')],
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      },
      {
        label: 'multi-component reply',
        replyPlan: plan({
          acknowledgements: [
            ACKS.destination('Cairns'),
            ACKS.origin('Sydney'),
          ],
          followUpQuestion: FOLLOW_UPS.departureDate,
          messageInterpreted: true,
        }),
      },
      {
        label: 'empty reply plan',
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
      const expected = expectedActivatedBaselineReply(frozen);
      const viaProduction = renderIntegratedConversationReplyPlan({
        plan: frozen,
      });
      const viaBaselineMode = renderConversationReplyPlanByIntegrationMode({
        plan: frozen,
        mode: 'baseline-conversational',
      });

      expect(viaProduction, entry.label).toBe(expected);
      expect(viaBaselineMode, `${entry.label} / baseline mode`).toBe(expected);
      if (expected === deterministic) {
        expect(viaProduction, `${entry.label} / deterministic parity`).toBe(
          deterministic,
        );
      } else {
        expect(viaProduction, `${entry.label} / intentional divergence`).not.toBe(
          deterministic,
        );
      }
      expect(frozen, `${entry.label} / unchanged`).toEqual(before);
      expect(Object.isFrozen(frozen), entry.label).toBe(true);
    }

    const failurePlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze([ACKS.origin('Sydney')]),
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
      throw new Error('forced-baseline-failure:14n');
    });

    const fallbackReply = renderIntegratedConversationReplyPlan({
      plan: failurePlan,
    });
    const fallbackViaMode = renderConversationReplyPlanByIntegrationMode({
      plan: failurePlan,
      mode: 'baseline-conversational',
    });

    expect(fallbackReply).toBe(failureExpected);
    expect(fallbackViaMode).toBe(failureExpected);
    expect(failurePlan).toEqual(failureBefore);
    expect(Object.isFrozen(failurePlan)).toBe(true);
  });

  it('proves no runtime selection mechanisms and no evaluation helpers on the production path', () => {
    for (const sourcePath of PRODUCTION_PATH_SOURCES) {
      const source = readFileSync(sourcePath, 'utf8');
      for (const marker of RUNTIME_SELECTION_MARKERS) {
        expect(
          source.includes(marker),
          `${sourcePath} must not contain ${marker}`,
        ).toBe(false);
      }
      for (const marker of EVALUATION_ONLY_MARKERS) {
        expect(
          source.includes(marker),
          `${sourcePath} must not import ${marker}`,
        ).toBe(false);
      }
    }

    const index = readFileSync(INDEX_SOURCE, 'utf8');
    for (const marker of EVALUATION_ONLY_MARKERS) {
      expect(index.includes(marker), `barrel must not expose ${marker}`).toBe(
        false,
      );
    }
    expect(index.includes('renderIntegratedConversationReplyPlan')).toBe(false);
    expect(index.includes('renderConversationReplyPlanByIntegrationMode')).toBe(
      false,
    );
    expect(index.includes('generateBaselineConversationalReply')).toBe(false);
    expect(index.includes('ConversationReplyPlanIntegrationMode')).toBe(false);
  });
});
