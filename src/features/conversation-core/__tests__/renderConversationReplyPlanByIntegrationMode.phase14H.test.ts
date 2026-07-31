import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  renderConversationReplyPlanByIntegrationMode,
  type ConversationReplyPlanIntegrationMode,
} from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 14H — mode-driven plan renderer characterisation.
 *
 * Proves both integration branches are directly parity-tested through
 * renderConversationReplyPlanByIntegrationMode while the production wrapper
 * remains permanently on the activated baseline mode.
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
const INTEGRATED_REPLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateIntegratedConversationReply.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const ALL_MODES = [
  'deterministic',
  'baseline-conversational',
] as const satisfies readonly ConversationReplyPlanIntegrationMode[];

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

describe('phase 14H — renderConversationReplyPlanByIntegrationMode', () => {
  it('keeps production deterministic and isolates mode acceptance to the extracted function', () => {
    const modeSource = readFileSync(MODE_SOURCE, 'utf8');
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const integrated = readFileSync(INTEGRATED_REPLY_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');

    expect(modeSource).toMatch(
      /export type ConversationReplyPlanIntegrationMode =\s*\|\s*'deterministic'\s*\|\s*'baseline-conversational'/,
    );
    expect(modeSource).toMatch(
      /export type RenderConversationReplyPlanByIntegrationModeInput/,
    );
    expect(modeSource).toMatch(
      /export function renderConversationReplyPlanByIntegrationMode/,
    );
    expect(modeSource).toMatch(/switch \(input\.mode\)/);
    expect(modeSource).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );
    expect(modeSource).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);\s*\} catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );
    expect(modeSource.match(/case '/g)?.length).toBe(2);
    expect(modeSource.includes('as ')).toBe(false);
    expect(modeSource.includes('process.env')).toBe(false);
    expect(modeSource.includes('featureFlag')).toBe(false);
    expect(modeSource.includes('Math.random')).toBe(false);
    expect(modeSource.includes('percentage')).toBe(false);
    expect(modeSource.includes('request')).toBe(false);
    expect(modeSource.includes('session')).toBe(false);
    expect(modeSource.includes('userId')).toBe(false);
    expect(modeSource.includes('URLSearchParams')).toBe(false);
    expect(modeSource.includes('window.')).toBe(false);
    expect(modeSource.includes('if (')).toBe(false);
    expect(modeSource.includes('console.')).toBe(false);

    expect(seam).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(seam).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode,\s*\}\)/,
    );
    expect(seam.includes('mode?:')).toBe(false);
    expect(seam.includes('input.mode')).toBe(false);
    expect(seam).toMatch(
      /export function renderIntegratedConversationReplyPlan\(\s*input: RenderIntegratedConversationReplyPlanInput,\s*\): string/,
    );
    expect(seam.includes('generateBaselineConversationalReply')).toBe(false);
    expect(seam.includes('renderConversationReplyPlan(')).toBe(false);
    expect(seam.includes('switch (')).toBe(false);
    expect(seam.includes('as ')).toBe(false);
    expect(seam.includes('process.env')).toBe(false);
    expect(seam.includes('featureFlag')).toBe(false);

    expect(generate).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(generate.includes('renderConversationReplyPlanByIntegrationMode')).toBe(
      false,
    );
    expect(generate.includes('ConversationReplyPlanIntegrationMode')).toBe(
      false,
    );
    expect(processTurn.includes('renderConversationReplyPlanByIntegrationMode')).toBe(
      false,
    );
    expect(processTurn.includes('ConversationReplyPlanIntegrationMode')).toBe(
      false,
    );
    expect(integrated.includes('renderConversationReplyPlanByIntegrationMode')).toBe(
      false,
    );
    expect(integrated.includes('ConversationReplyPlanIntegrationMode')).toBe(
      false,
    );

    expect(index.includes('renderConversationReplyPlanByIntegrationMode')).toBe(
      false,
    );
    expect(index.includes('ConversationReplyPlanIntegrationMode')).toBe(false);
    expect(index.includes('renderIntegratedConversationReplyPlan')).toBe(false);
  });

  it('parity-tests both modes against the existing plan without mutation', () => {
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
        label: 'follow-up only',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.activities,
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
        label: 'acknowledgement only',
        replyPlan: plan({
          acknowledgements: [ACKS.genericTravelFieldChange],
          followUpQuestion: null,
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
        label: 'multi-component acknowledgements',
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
        label: 'empty plan',
        replyPlan: plan(),
      },
    ];

    expect(ALL_MODES).toEqual([
      'deterministic',
      'baseline-conversational',
    ]);

    for (const entry of cases) {
      const before = structuredClone(entry.replyPlan);
      const deterministic = renderConversationReplyPlan(entry.replyPlan);
      const baseline = generateBaselineConversationalReply(entry.replyPlan);
      const expectedBaseline = expectedActivatedBaselineReply(entry.replyPlan);

      const viaDeterministicMode = renderConversationReplyPlanByIntegrationMode({
        plan: entry.replyPlan,
        mode: 'deterministic',
      });
      const viaBaselineMode = renderConversationReplyPlanByIntegrationMode({
        plan: entry.replyPlan,
        mode: 'baseline-conversational',
      });
      const viaProduction = renderIntegratedConversationReplyPlan({
        plan: entry.replyPlan,
      });

      expect(viaDeterministicMode, entry.label).toBe(deterministic);
      expect(viaBaselineMode, `${entry.label} / baseline mode`).toBe(baseline);
      expect(baseline, `${entry.label} / baseline expected`).toBe(
        expectedBaseline,
      );
      expect(viaProduction, `${entry.label} / production`).toBe(
        expectedBaseline,
      );
      if (
        entry.replyPlan.acknowledgements.length !== 1
      ) {
        expect(baseline, `${entry.label} / deterministic parity`).toBe(
          deterministic,
        );
      }
      expect(entry.replyPlan, `${entry.label} / unchanged`).toEqual(before);
    }

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
        mode: 'deterministic',
      }),
    ).toBe(`${ACKS.destination('Brisbane')}\n${FOLLOW_UPS.origin}`);

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
        mode: 'baseline-conversational',
      }),
    ).toBe(`${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`);

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

  it('does not mutate a frozen plan in either mode', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze([ACKS.origin('Sydney')]),
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(replyPlan);
    const deterministicExpected = renderConversationReplyPlan(replyPlan);
    const baselineExpected = expectedActivatedBaselineReply(replyPlan);

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: replyPlan,
        mode: 'deterministic',
      }),
    ).toBe(deterministicExpected);
    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: replyPlan,
        mode: 'baseline-conversational',
      }),
    ).toBe(baselineExpected);
    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      baselineExpected,
    );
    expect(replyPlan).toEqual(before);
    expect(Object.isFrozen(replyPlan)).toBe(true);
  });
});
