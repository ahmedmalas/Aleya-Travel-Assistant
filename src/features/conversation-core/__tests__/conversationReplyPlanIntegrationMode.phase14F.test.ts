import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';

/**
 * Phase 14F — explicit deterministic plan-rendering integration mode.
 *
 * Proves the plan-level seam declares only `'deterministic'`, delegates
 * through an exhaustive switch to renderConversationReplyPlan, and does not
 * expose any alternate mode selection path.
 */

const ROOT = process.cwd();
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
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

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const CONVERSATIONAL_MARKERS = [
  'generateBaselineConversationalReply',
  'renderBaselineConversationalReplyPlan',
  'renderBaselineConversationalLayer',
  'buildConversationalLayerInput',
  'executeBaselineConversationalRenderer',
  'executeConversationalLayerRenderer',
  'createBaselineConversationalRendererRegistry',
  'invokeConversationalLayerRenderer',
  'ConversationalLayerRenderer',
  'ConversationalLayerInput',
  'conversationalLayerContracts',
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

describe('phase 14F — conversation reply plan integration mode', () => {
  it('declares only the deterministic mode and uses an exhaustive internal switch', () => {
    const source = readFileSync(SEAM_SOURCE, 'utf8');

    expect(source).toMatch(
      /type ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );
    expect(source).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );
    expect(source).toMatch(/switch \(mode\)/);
    expect(source).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );

    expect(source.includes("'conversational'")).toBe(false);
    expect(source.includes("'baseline'")).toBe(false);
    expect(source.includes("'experimental'")).toBe(false);
    expect(source.includes('process.env')).toBe(false);
    expect(source.includes('import.meta.env')).toBe(false);
    expect(source.includes('featureFlag')).toBe(false);
    expect(source.includes('mode?:')).toBe(false);
    expect(source.includes('integrationMode')).toBe(false);

    // Public contract remains plan-only — no mode argument.
    expect(source).toMatch(
      /export type RenderIntegratedConversationReplyPlanInput = Readonly<\{\s*plan: Readonly<ConversationReplyPlan>;\s*\}>/,
    );
    expect(source).toMatch(
      /export function renderIntegratedConversationReplyPlan\(\s*input: RenderIntegratedConversationReplyPlanInput,\s*\): string/,
    );
    expect(source.includes('mode:')).toBe(true); // internal const only
    expect(source.includes('input.mode')).toBe(false);
    expect(source.includes('request')).toBe(false);
    expect(source.includes('session')).toBe(false);
    expect(source.includes('userId')).toBe(false);
    expect(source.includes('URL')).toBe(false);
    expect(source.includes('window.')).toBe(false);
    expect(source.includes('localStorage')).toBe(false);
    expect(source.includes('input.plan.kind')).toBe(false);
    expect(source.includes('if (')).toBe(false);

    // Exactly one case arm in the mode switch.
    expect(source.match(/case '/g)?.length).toBe(1);
    expect(source.match(/case 'deterministic'/g)?.length).toBe(1);

    // Mode type/constant not exported from the module or barrel.
    expect(source.includes('export type ConversationReplyPlanIntegrationMode')).toBe(
      false,
    );
    expect(source.includes('export const mode')).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'ConversationReplyPlanIntegrationMode',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'renderIntegratedConversationReplyPlan',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'ConversationReplyPlanIntegrationMode',
      ),
    ).toBe(false);
    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'ConversationReplyPlanIntegrationMode',
      ),
    ).toBe(false);
    expect(
      readFileSync(INTEGRATED_REPLY_SOURCE, 'utf8').includes(
        'ConversationReplyPlanIntegrationMode',
      ),
    ).toBe(false);
  });

  it('keeps the plan seam free of conversational-layer imports and invocation', () => {
    const source = readFileSync(SEAM_SOURCE, 'utf8');

    for (const marker of CONVERSATIONAL_MARKERS) {
      expect(source.includes(marker), `must not reference ${marker}`).toBe(
        false,
      );
    }
  });

  it('preserves exact deterministic outputs through the explicit mode branch', () => {
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
        label: 'empty plan',
        replyPlan: plan(),
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
    ];

    for (const entry of cases) {
      const before = structuredClone(entry.replyPlan);
      const deterministic = renderConversationReplyPlan(entry.replyPlan);
      const integrated = renderIntegratedConversationReplyPlan({
        plan: entry.replyPlan,
      });

      expect(integrated, entry.label).toBe(deterministic);
      expect(
        renderIntegratedConversationReplyPlan({ plan: entry.replyPlan }),
        `${entry.label} / repeat`,
      ).toBe(deterministic);
      expect(entry.replyPlan, `${entry.label} / unchanged`).toEqual(before);
    }

    expect(
      renderIntegratedConversationReplyPlan({
        plan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
      }),
    ).toBe(`${ACKS.destination('Brisbane')}\n${FOLLOW_UPS.origin}`);

    expect(
      renderIntegratedConversationReplyPlan({
        plan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      }),
    ).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('does not mutate a frozen plan through the mode branch', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze([ACKS.origin('Sydney')]),
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(replyPlan);
    const expected = renderConversationReplyPlan(replyPlan);

    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      expected,
    );
    expect(replyPlan).toEqual(before);
    expect(Object.isFrozen(replyPlan)).toBe(true);
  });
});
