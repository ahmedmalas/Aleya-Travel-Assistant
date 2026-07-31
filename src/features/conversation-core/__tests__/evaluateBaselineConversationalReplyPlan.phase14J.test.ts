import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { evaluateBaselineConversationalReplyPlan } from '../evaluateBaselineConversationalReplyPlan';
import * as baselineModule from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import * as generateConversationReplyModule from '../generateConversationReply';
import * as modeDrivenModule from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';

/**
 * Phase 14J — isolated baseline conversational evaluation entry point.
 *
 * Proves evaluateBaselineConversationalReplyPlan deliberately selects
 * `'baseline-conversational'` through the mode-driven renderer without
 * entering the production path.
 */

const ROOT = process.cwd();
const EVAL_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/evaluateBaselineConversationalReplyPlan.ts',
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

describe('phase 14J — evaluateBaselineConversationalReplyPlan', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is an isolated evaluation boundary that always selects baseline-conversational', () => {
    const source = readFileSync(EVAL_SOURCE, 'utf8');

    expect(source).toMatch(
      /export function evaluateBaselineConversationalReplyPlan/,
    );
    expect(source).toMatch(
      /export type EvaluateBaselineConversationalReplyPlanInput/,
    );
    expect(source).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode: 'baseline-conversational',\s*\}\)/,
    );
    expect(source).toMatch(
      /from '\.\/renderConversationReplyPlanByIntegrationMode'/,
    );

    expect(source.includes('generateBaselineConversationalReply')).toBe(false);
    expect(source.includes('createConversationReplyPlan')).toBe(false);
    expect(source.includes('assembleConversationReplyPlan(')).toBe(false);
    expect(source.includes('process.env')).toBe(false);
    expect(source.includes('import.meta.env')).toBe(false);
    expect(source.includes('featureFlag')).toBe(false);
    expect(source.includes('Math.random')).toBe(false);
    expect(source.includes('percentage')).toBe(false);
    expect(source.includes('request')).toBe(false);
    expect(source.includes('session')).toBe(false);
    expect(source.includes('userId')).toBe(false);
    expect(source.includes('URLSearchParams')).toBe(false);
    expect(source.includes('window.')).toBe(false);
    expect(source.includes('console.')).toBe(false);
    expect(source.includes('telemetry')).toBe(false);
    expect(source.includes('if (')).toBe(false);
    expect(source.includes('switch (')).toBe(false);

    expect(readFileSync(INDEX_SOURCE, 'utf8').includes(
      'evaluateBaselineConversationalReplyPlan',
    )).toBe(false);

    for (const productionPath of PRODUCTION_CALLERS) {
      expect(
        readFileSync(productionPath, 'utf8').includes(
          'evaluateBaselineConversationalReplyPlan',
        ),
        `${productionPath} must not import the evaluation entry point`,
      ).toBe(false);
    }

    // No production .ts module under conversation-core imports the evaluation entry.
    // Phase 14K comparison is evaluation-only and may import it.
    for (const name of readdirSync(CONVERSATION_CORE_DIR)) {
      if (!name.endsWith('.ts')) continue;
      if (name === 'evaluateBaselineConversationalReplyPlan.ts') continue;
      if (name === 'compareBaselineConversationalReplyPlan.ts') continue;
      const relative = `src/features/conversation-core/${name}`;
      const contents = readFileSync(resolve(CONVERSATION_CORE_DIR, name), 'utf8');
      expect(
        contents.includes('evaluateBaselineConversationalReplyPlan'),
        `${relative} must not reference the evaluation entry point`,
      ).toBe(false);
    }

    expect(readFileSync(SEAM_SOURCE, 'utf8')).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );
  });

  it('delegates through the mode-driven renderer and never calls the baseline generator directly', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.destination('Brisbane')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const before = structuredClone(replyPlan);

    const modeSpy = vi
      .spyOn(modeDrivenModule, 'renderConversationReplyPlanByIntegrationMode')
      .mockReturnValue('evaluation-via-mode-driven');
    const directBaselineSpy = vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    );

    expect(
      evaluateBaselineConversationalReplyPlan({ plan: replyPlan }),
    ).toBe('evaluation-via-mode-driven');
    expect(modeSpy).toHaveBeenCalledTimes(1);
    expect(modeSpy.mock.calls[0]?.[0]).toEqual({
      plan: replyPlan,
      mode: 'baseline-conversational',
    });
    expect(modeSpy.mock.calls[0]?.[0]?.plan).toBe(replyPlan);
    expect(directBaselineSpy).not.toHaveBeenCalled();
    expect(replyPlan).toEqual(before);
  });

  it('preserves successful baseline parity across representative plans', () => {
    const cases: Array<{ label: string; replyPlan: ConversationReplyPlan }> = [
      {
        label: 'empty',
        replyPlan: plan(),
      },
      {
        label: 'acknowledgement',
        replyPlan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: null,
          messageInterpreted: true,
        }),
      },
      {
        label: 'follow-up',
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
    ];

    for (const entry of cases) {
      const before = structuredClone(entry.replyPlan);
      const expected = baselineModule.generateBaselineConversationalReply(
        entry.replyPlan,
      );

      const result = evaluateBaselineConversationalReplyPlan({
        plan: entry.replyPlan,
      });

      expect(result, entry.label).toBe(expected);
      expect(result, `${entry.label} / deterministic parity`).toBe(
        renderConversationReplyPlan(entry.replyPlan),
      );
      expect(entry.replyPlan, `${entry.label} / unchanged`).toEqual(before);
    }

    expect(
      evaluateBaselineConversationalReplyPlan({
        plan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      }),
    ).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('preserves the existing deterministic fallback when baseline rendering fails', () => {
    const cases: Array<{ label: string; replyPlan: ConversationReplyPlan }> = [
      {
        label: 'empty',
        replyPlan: plan(),
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
    ];

    for (const entry of cases) {
      vi.restoreAllMocks();
      const before = structuredClone(entry.replyPlan);
      const expected = renderConversationReplyPlan(entry.replyPlan);

      vi.spyOn(
        baselineModule,
        'generateBaselineConversationalReply',
      ).mockImplementation((receivedPlan) => {
        expect(receivedPlan).toBe(entry.replyPlan);
        throw new Error(`forced-baseline-failure:${entry.label}`);
      });
      const deterministicSpy = vi.spyOn(
        generateConversationReplyModule,
        'renderConversationReplyPlan',
      );

      let escaped: unknown;
      let result: string | undefined;
      try {
        result = evaluateBaselineConversationalReplyPlan({
          plan: entry.replyPlan,
        });
      } catch (error) {
        escaped = error;
      }

      expect(escaped, entry.label).toBeUndefined();
      expect(result, entry.label).toBe(expected);
      expect(deterministicSpy, entry.label).toHaveBeenCalledTimes(1);
      expect(deterministicSpy.mock.calls[0]?.[0], entry.label).toBe(
        entry.replyPlan,
      );
      expect(entry.replyPlan, `${entry.label} / unchanged`).toEqual(before);
    }
  });

  it('does not affect production deterministic selection', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    });
    const expected = renderConversationReplyPlan(replyPlan);

    const baselineSpy = vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    );

    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      expected,
    );
    expect(baselineSpy).not.toHaveBeenCalled();
  });
});
