import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import * as baselineModule from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import * as generateConversationReplyModule from '../generateConversationReply';
import { renderConversationReplyPlanByIntegrationMode } from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 14I — deterministic fallback for baseline rendering failure.
 *
 * Proves the baseline branch catches synchronous failures and falls back to
 * renderConversationReplyPlan with the same plan.
 *
 * Phase 14N: accepted production mode is `'baseline-conversational'`; fallback
 * therefore applies on the production path as well.
 */

const ROOT = process.cwd();
const MODE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
);
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
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

describe('phase 14I — baseline rendering fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps only the baseline branch with a silent deterministic fallback', () => {
    const modeSource = readFileSync(MODE_SOURCE, 'utf8');
    const seam = readFileSync(SEAM_SOURCE, 'utf8');

    expect(modeSource).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );
    expect(modeSource).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);\s*\} catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );

    // Deterministic branch is not wrapped.
    expect(modeSource).not.toMatch(
      /case 'deterministic':\s*try/,
    );

    expect(modeSource.includes('console.')).toBe(false);
    expect(modeSource.includes('telemetry')).toBe(false);
    expect(modeSource.includes('analytics')).toBe(false);
    expect(modeSource.includes('counter')).toBe(false);
    expect(modeSource.includes('process.env')).toBe(false);
    expect(modeSource.includes('featureFlag')).toBe(false);
    expect(modeSource.includes('Math.random')).toBe(false);
    expect(modeSource.includes('percentage')).toBe(false);
    expect(modeSource.includes('createConversationReplyPlan')).toBe(false);
    expect(modeSource.includes('assembleConversationReplyPlan(')).toBe(false);

    expect(seam).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(seam).not.toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );
    expect(readFileSync(GENERATE_SOURCE, 'utf8')).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'renderConversationReplyPlanByIntegrationMode',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'renderConversationReplyPlanByIntegrationMode',
      ),
    ).toBe(false);
  });

  it('keeps successful baseline output exactly unchanged across representative plans', () => {
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
      const viaMode = renderConversationReplyPlanByIntegrationMode({
        plan: entry.replyPlan,
        mode: 'baseline-conversational',
      });

      expect(viaMode, entry.label).toBe(expected);
      expect(viaMode, `${entry.label} / baseline expected`).toBe(
        expectedActivatedBaselineReply(entry.replyPlan),
      );
      if (expected === renderConversationReplyPlan(entry.replyPlan)) {
        expect(viaMode, `${entry.label} / deterministic parity`).toBe(
          renderConversationReplyPlan(entry.replyPlan),
        );
      } else {
        expect(viaMode, `${entry.label} / intentional divergence`).not.toBe(
          renderConversationReplyPlan(entry.replyPlan),
        );
      }
      expect(entry.replyPlan, `${entry.label} / unchanged`).toEqual(before);
    }

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
        mode: 'baseline-conversational',
      }),
    ).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('falls back to the deterministic renderer with the same plan when baseline throws', () => {
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
      vi.restoreAllMocks();
      const before = structuredClone(entry.replyPlan);
      const expected = renderConversationReplyPlan(entry.replyPlan);
      const failure = new Error(`forced-baseline-failure:${entry.label}`);

      const baselineSpy = vi
        .spyOn(baselineModule, 'generateBaselineConversationalReply')
        .mockImplementation((receivedPlan) => {
          expect(receivedPlan).toBe(entry.replyPlan);
          throw failure;
        });
      const deterministicSpy = vi.spyOn(
        generateConversationReplyModule,
        'renderConversationReplyPlan',
      );

      let escaped: unknown = undefined;
      let result: string | undefined;
      try {
        result = renderConversationReplyPlanByIntegrationMode({
          plan: entry.replyPlan,
          mode: 'baseline-conversational',
        });
      } catch (error) {
        escaped = error;
      }

      expect(escaped, entry.label).toBeUndefined();
      expect(result, entry.label).toBe(expected);
      expect(baselineSpy, entry.label).toHaveBeenCalledTimes(1);
      expect(baselineSpy.mock.calls[0]?.[0], entry.label).toBe(entry.replyPlan);
      expect(deterministicSpy, entry.label).toHaveBeenCalledTimes(1);
      expect(deterministicSpy.mock.calls[0]?.[0], entry.label).toBe(
        entry.replyPlan,
      );
      expect(entry.replyPlan, `${entry.label} / unchanged`).toEqual(before);
    }
  });

  it('does not invoke the fallback path on the deterministic branch', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    });
    const deterministicExpected = renderConversationReplyPlan(replyPlan);
    const baselineExpected = expectedActivatedBaselineReply(replyPlan);

    const baselineSpy = vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    );
    const deterministicSpy = vi.spyOn(
      generateConversationReplyModule,
      'renderConversationReplyPlan',
    );

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: replyPlan,
        mode: 'deterministic',
      }),
    ).toBe(deterministicExpected);

    expect(baselineSpy).not.toHaveBeenCalled();
    expect(deterministicSpy).toHaveBeenCalledTimes(1);
    expect(deterministicSpy.mock.calls[0]?.[0]).toBe(replyPlan);

    // Production wrapper reaches the baseline branch (Phase 14N).
    // Baseline wording itself may call renderConversationReplyPlan for parity;
    // the mode-driven catch fallback is not required on the success path.
    baselineSpy.mockClear();
    deterministicSpy.mockClear();
    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      baselineExpected,
    );
    expect(baselineSpy).toHaveBeenCalledTimes(1);
    expect(baselineSpy.mock.calls[0]?.[0]).toBe(replyPlan);
  });

  it('does not mutate a frozen plan when falling back', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze([ACKS.destination('Hobart')]),
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(replyPlan);
    const expected = renderConversationReplyPlan(replyPlan);

    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation(() => {
      throw new Error('forced-baseline-failure:frozen');
    });

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: replyPlan,
        mode: 'baseline-conversational',
      }),
    ).toBe(expected);
    expect(replyPlan).toEqual(before);
    expect(Object.isFrozen(replyPlan)).toBe(true);
  });
});
