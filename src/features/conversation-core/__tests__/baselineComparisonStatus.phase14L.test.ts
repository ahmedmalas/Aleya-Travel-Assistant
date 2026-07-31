import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { compareBaselineConversationalReplyPlan } from '../compareBaselineConversationalReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import * as baselineModule from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 14L — structured baseline comparison status characterisation.
 *
 * Proves identical / different / fallback classification without inferring
 * fallback from string equality, and without production wiring.
 */

const ROOT = process.cwd();
const COMPARE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/compareBaselineConversationalReplyPlan.ts',
);
const OUTCOME_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/evaluateBaselineConversationalReplyPlanOutcome.ts',
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

const EVALUATION_MARKERS = [
  'compareBaselineConversationalReplyPlan',
  'evaluateBaselineConversationalReplyPlanOutcome',
  'BaselineConversationalComparisonStatus',
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

describe('phase 14L — baseline comparison status', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps status classification evaluation-only and outside production', () => {
    const compareSource = readFileSync(COMPARE_SOURCE, 'utf8');
    const outcomeSource = readFileSync(OUTCOME_SOURCE, 'utf8');

    expect(compareSource).toMatch(
      /export type BaselineConversationalComparisonStatus =\s*\|\s*'identical'\s*\|\s*'different'\s*\|\s*'fallback'/,
    );
    expect(compareSource).toMatch(/status: BaselineConversationalComparisonStatus/);
    expect(compareSource).toMatch(
      /evaluateBaselineConversationalReplyPlanOutcome\(\{\s*plan: input\.plan,\s*\}\)/,
    );
    expect(compareSource).toMatch(/baselineOutcome\.usedFallback/);

    expect(outcomeSource).toMatch(
      /export function evaluateBaselineConversationalReplyPlanOutcome/,
    );
    expect(outcomeSource).toMatch(/usedFallback: false/);
    expect(outcomeSource).toMatch(/usedFallback: true/);
    expect(outcomeSource).toMatch(/try \{/);
    expect(outcomeSource).toMatch(/catch \{/);
    expect(outcomeSource.includes('console.')).toBe(false);
    expect(outcomeSource.includes('telemetry')).toBe(false);
    expect(outcomeSource.includes('process.env')).toBe(false);
    expect(outcomeSource.includes('featureFlag')).toBe(false);
    expect(outcomeSource.includes('createConversationReplyPlan')).toBe(false);
    expect(outcomeSource.includes('assembleConversationReplyPlan(')).toBe(
      false,
    );

    expect(readFileSync(INDEX_SOURCE, 'utf8').includes(
      'BaselineConversationalComparisonStatus',
    )).toBe(false);
    expect(readFileSync(INDEX_SOURCE, 'utf8').includes(
      'evaluateBaselineConversationalReplyPlanOutcome',
    )).toBe(false);
    expect(readFileSync(INDEX_SOURCE, 'utf8').includes(
      'compareBaselineConversationalReplyPlan',
    )).toBe(false);

    for (const productionPath of PRODUCTION_CALLERS) {
      const source = readFileSync(productionPath, 'utf8');
      for (const marker of EVALUATION_MARKERS) {
        expect(
          source.includes(marker),
          `${productionPath} must not reference ${marker}`,
        ).toBe(false);
      }
    }

    for (const name of readdirSync(CONVERSATION_CORE_DIR)) {
      if (!name.endsWith('.ts')) continue;
      if (
        name === 'compareBaselineConversationalReplyPlan.ts' ||
        name === 'evaluateBaselineConversationalReplyPlan.ts' ||
        name === 'evaluateBaselineConversationalReplyPlanOutcome.ts'
      ) {
        continue;
      }
      const contents = readFileSync(resolve(CONVERSATION_CORE_DIR, name), 'utf8');
      for (const marker of EVALUATION_MARKERS) {
        expect(
          contents.includes(marker),
          `${name} must not reference ${marker}`,
        ).toBe(false);
      }
    }

    expect(readFileSync(SEAM_SOURCE, 'utf8')).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
  });

  it('classifies successful matching baseline output as identical', () => {
    // Empty plan remains deterministic fall-through (null-coalesce), so identical.
    const replyPlan = plan({
      acknowledgements: [],
      followUpQuestion: null,
      messageInterpreted: false,
    });
    const before = structuredClone(replyPlan);
    const expected = renderConversationReplyPlan(replyPlan);

    const comparison = compareBaselineConversationalReplyPlan({
      plan: replyPlan,
    });

    expect(comparison).toEqual({
      deterministicReply: expected,
      baselineReply: expected,
      matchesDeterministic: true,
      status: 'identical',
    });
    expect(replyPlan).toEqual(before);
  });

  it('classifies successful neutral-continuation baseline divergence as different', () => {
    const replyPlan = plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    });
    const before = structuredClone(replyPlan);
    const deterministicExpected = renderConversationReplyPlan(replyPlan);
    const baselineExpected = expectedActivatedBaselineReply(replyPlan);

    const comparison = compareBaselineConversationalReplyPlan({
      plan: replyPlan,
    });

    expect(comparison).toEqual({
      deterministicReply: deterministicExpected,
      baselineReply: baselineExpected,
      matchesDeterministic: false,
      status: 'different',
    });
    expect(replyPlan).toEqual(before);
  });

  it('classifies successful follow-up-only baseline divergence as different', () => {
    const replyPlan = plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.activities,
      messageInterpreted: true,
    });
    const before = structuredClone(replyPlan);
    const deterministicExpected = renderConversationReplyPlan(replyPlan);
    const baselineExpected = expectedActivatedBaselineReply(replyPlan);

    const comparison = compareBaselineConversationalReplyPlan({
      plan: replyPlan,
    });

    expect(comparison.deterministicReply).toBe(deterministicExpected);
    expect(comparison.baselineReply).toBe(baselineExpected);
    expect(comparison.baselineReply).toBe(
      `Let's look at activities. ${FOLLOW_UPS.activities}`,
    );
    expect(comparison.matchesDeterministic).toBe(false);
    expect(comparison.status).toBe('different');
    expect(replyPlan).toEqual(before);
  });

  it('classifies successful ack+follow-up baseline divergence as different', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.destination('Brisbane')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const before = structuredClone(replyPlan);
    const deterministicExpected = renderConversationReplyPlan(replyPlan);

    const comparison = compareBaselineConversationalReplyPlan({
      plan: replyPlan,
    });

    expect(comparison.deterministicReply).toBe(deterministicExpected);
    expect(comparison.baselineReply).not.toBe(deterministicExpected);
    expect(comparison.matchesDeterministic).toBe(false);
    expect(comparison.status).toBe('different');
    expect(replyPlan).toEqual(before);
  });

  it('classifies successful different baseline output as different without throwing', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    });
    const before = structuredClone(replyPlan);
    const deterministicExpected = renderConversationReplyPlan(replyPlan);

    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      expect(receivedPlan).toBe(replyPlan);
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
      status: 'different',
    });
    expect(replyPlan).toEqual(before);
  });

  it('classifies forced baseline failure as fallback, not identical', () => {
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
      throw new Error('forced-baseline-failure:status');
    });

    const comparison = compareBaselineConversationalReplyPlan({
      plan: replyPlan,
    });

    // Same strings as a successful match, but status must be fallback.
    expect(comparison.deterministicReply).toBe(expected);
    expect(comparison.baselineReply).toBe(expected);
    expect(comparison.matchesDeterministic).toBe(true);
    expect(comparison.status).toBe('fallback');
    expect(comparison.status).not.toBe('identical');
    expect(replyPlan).toEqual(before);
  });

  it('does not infer fallback from equal strings on successful baseline output', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.addedCapabilities('flights')],
      followUpQuestion: FOLLOW_UPS.flightsAdultCount,
      messageInterpreted: true,
    });
    const expected = renderConversationReplyPlan(replyPlan);

    // Successful baseline returns the same wording as deterministic.
    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      expect(receivedPlan).toBe(replyPlan);
      return expected;
    });

    const comparison = compareBaselineConversationalReplyPlan({
      plan: replyPlan,
    });

    expect(comparison.matchesDeterministic).toBe(true);
    expect(comparison.deterministicReply).toBe(expected);
    expect(comparison.baselineReply).toBe(expected);
    expect(comparison.status).toBe('identical');
    expect(comparison.status).not.toBe('fallback');
  });

  it('keeps production output parity-identical after baseline activation', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.destination('Cairns')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const expected = expectedActivatedBaselineReply(replyPlan);

    const baselineSpy = vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    );

    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      expected,
    );
    expect(baselineSpy).toHaveBeenCalledTimes(1);
    expect(baselineSpy.mock.calls[0]?.[0]).toBe(replyPlan);
  });
});
