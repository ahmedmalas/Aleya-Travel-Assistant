import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { compareBaselineConversationalReplyPlan } from '../compareBaselineConversationalReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import * as evaluateModule from '../evaluateBaselineConversationalReplyPlan';
import * as baselineModule from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import * as modeDrivenModule from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';

/**
 * Phase 14K — structured baseline reply-plan comparison characterisation.
 *
 * Proves compareBaselineConversationalReplyPlan renders the same plan through
 * both deterministic and baseline evaluation paths and reports parity without
 * entering production.
 */

const ROOT = process.cwd();
const COMPARE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/compareBaselineConversationalReplyPlan.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const INTEGRATED_REPLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateIntegratedConversationReply.ts',
);
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
);
const MODE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
);
const CONVERSATION_CORE_DIR = resolve(ROOT, 'src/features/conversation-core');

const PRODUCTION_CALLERS = [
  PROCESS_TURN_SOURCE,
  GENERATE_SOURCE,
  INTEGRATED_REPLY_SOURCE,
  SEAM_SOURCE,
  MODE_SOURCE,
] as const;

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

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

describe('phase 14K — compareBaselineConversationalReplyPlan', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is an isolated evaluation boundary with no production wiring', () => {
    const source = readFileSync(COMPARE_SOURCE, 'utf8');

    expect(source).toMatch(
      /export function compareBaselineConversationalReplyPlan/,
    );
    expect(source).toMatch(
      /export type CompareBaselineConversationalReplyPlanInput/,
    );
    expect(source).toMatch(
      /export type BaselineConversationalReplyPlanComparison/,
    );
    expect(source).toMatch(
      /renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode: 'deterministic',\s*\}\)/,
    );
    expect(source).toMatch(
      /evaluateBaselineConversationalReplyPlan\(\{\s*plan: input\.plan,\s*\}\)/,
    );
    expect(source).toMatch(
      /matchesDeterministic:\s*deterministicReply === baselineReply/,
    );

    expect(source.includes('generateBaselineConversationalReply')).toBe(false);
    expect(source.includes('renderConversationReplyPlan(')).toBe(false);
    expect(source.includes('createConversationReplyPlan')).toBe(false);
    expect(source.includes('assembleConversationReplyPlan(')).toBe(false);
    expect(source.includes('process.env')).toBe(false);
    expect(source.includes('featureFlag')).toBe(false);
    expect(source.includes('console.')).toBe(false);
    expect(source.includes('telemetry')).toBe(false);
    expect(source.includes('throw ')).toBe(false);

    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'compareBaselineConversationalReplyPlan',
      ),
    ).toBe(false);

    for (const productionPath of PRODUCTION_CALLERS) {
      expect(
        readFileSync(productionPath, 'utf8').includes(
          'compareBaselineConversationalReplyPlan',
        ),
        `${productionPath} must not import the comparison entry point`,
      ).toBe(false);
    }

    for (const name of readdirSync(CONVERSATION_CORE_DIR)) {
      if (!name.endsWith('.ts')) continue;
      if (name === 'compareBaselineConversationalReplyPlan.ts') continue;
      const relative = `src/features/conversation-core/${name}`;
      const contents = readFileSync(resolve(CONVERSATION_CORE_DIR, name), 'utf8');
      expect(
        contents.includes('compareBaselineConversationalReplyPlan'),
        `${relative} must not reference the comparison entry point`,
      ).toBe(false);
    }

    expect(readFileSync(SEAM_SOURCE, 'utf8')).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );
  });

  it('routes both paths through the required boundaries and reports current parity', () => {
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
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
      },
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
        label: 'multi-component',
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
        label: 'empty',
        replyPlan: plan(),
      },
    ];

    for (const entry of cases) {
      vi.restoreAllMocks();
      const before = structuredClone(entry.replyPlan);
      const expected = renderConversationReplyPlan(entry.replyPlan);

      const modeSpy = vi.spyOn(
        modeDrivenModule,
        'renderConversationReplyPlanByIntegrationMode',
      );
      const evaluateSpy = vi.spyOn(
        evaluateModule,
        'evaluateBaselineConversationalReplyPlan',
      );

      const comparison = compareBaselineConversationalReplyPlan({
        plan: entry.replyPlan,
      });

      expect(comparison.deterministicReply, entry.label).toBe(expected);
      expect(comparison.baselineReply, entry.label).toBe(expected);
      expect(comparison.matchesDeterministic, entry.label).toBe(true);

      expect(modeSpy, entry.label).toHaveBeenCalled();
      expect(
        modeSpy.mock.calls.some(
          (call) =>
            call[0]?.mode === 'deterministic' && call[0]?.plan === entry.replyPlan,
        ),
        `${entry.label} / deterministic mode path`,
      ).toBe(true);

      expect(evaluateSpy, entry.label).toHaveBeenCalledTimes(1);
      expect(evaluateSpy.mock.calls[0]?.[0], entry.label).toEqual({
        plan: entry.replyPlan,
      });
      expect(evaluateSpy.mock.calls[0]?.[0]?.plan, entry.label).toBe(
        entry.replyPlan,
      );
      expect(entry.replyPlan, `${entry.label} / unchanged`).toEqual(before);
    }
  });

  it('reports parity after baseline failure falls back to deterministic output', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.destination('Hobart')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const before = structuredClone(replyPlan);
    const expected = renderConversationReplyPlan(replyPlan);

    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      expect(receivedPlan).toBe(replyPlan);
      throw new Error('forced-baseline-failure:compare');
    });

    const comparison = compareBaselineConversationalReplyPlan({
      plan: replyPlan,
    });

    expect(comparison.deterministicReply).toBe(expected);
    expect(comparison.baselineReply).toBe(expected);
    expect(comparison.matchesDeterministic).toBe(true);
    expect(replyPlan).toEqual(before);
  });

  it('reports matchesDeterministic false for a controlled baseline difference without throwing', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    });
    const before = structuredClone(replyPlan);
    const deterministicExpected = renderConversationReplyPlan(replyPlan);

    vi.spyOn(
      evaluateModule,
      'evaluateBaselineConversationalReplyPlan',
    ).mockImplementation((input) => {
      expect(input.plan).toBe(replyPlan);
      return 'controlled-baseline-difference';
    });

    let escaped: unknown;
    let comparison:
      | ReturnType<typeof compareBaselineConversationalReplyPlan>
      | undefined;
    try {
      comparison = compareBaselineConversationalReplyPlan({ plan: replyPlan });
    } catch (error) {
      escaped = error;
    }

    expect(escaped).toBeUndefined();
    expect(comparison).toEqual({
      deterministicReply: deterministicExpected,
      baselineReply: 'controlled-baseline-difference',
      matchesDeterministic: false,
    });
    expect(replyPlan).toEqual(before);
  });

  it('does not affect production deterministic selection', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.destination('Cairns')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const expected = renderConversationReplyPlan(replyPlan);

    const evaluateSpy = vi.spyOn(
      evaluateModule,
      'evaluateBaselineConversationalReplyPlan',
    );

    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      expected,
    );
    expect(evaluateSpy).not.toHaveBeenCalled();
  });
});
