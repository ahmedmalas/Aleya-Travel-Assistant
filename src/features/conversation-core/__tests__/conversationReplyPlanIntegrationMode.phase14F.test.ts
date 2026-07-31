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
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 14F — explicit deterministic plan-rendering integration mode.
 *
 * Proves the production wrapper permanently selects a static integration mode
 * and delegates to the extracted mode-driven renderer, without exposing any
 * alternate production mode selection path.
 *
 * Phase 14N: accepted production mode is `'baseline-conversational'`.
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
  it('keeps production selection static and delegates to the extracted mode switch', () => {
    const source = readFileSync(SEAM_SOURCE, 'utf8');
    const modeSource = readFileSync(MODE_SOURCE, 'utf8');

    expect(source).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(source).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode,\s*\}\)/,
    );
    expect(source.includes('switch (')).toBe(false);

    expect(modeSource).toMatch(
      /export type ConversationReplyPlanIntegrationMode =\s*\|\s*'deterministic'\s*\|\s*'baseline-conversational'/,
    );
    expect(modeSource).toMatch(/switch \(input\.mode\)/);
    expect(modeSource).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );
    expect(modeSource).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);\s*\} catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );

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

    // Exactly two case arms live on the extracted mode-driven module.
    expect(modeSource.match(/case '/g)?.length).toBe(2);
    expect(modeSource.match(/case 'deterministic'/g)?.length).toBe(1);
    expect(modeSource.match(/case 'baseline-conversational'/g)?.length).toBe(1);
    expect(source).not.toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );

    // Mode type is not exported from the production wrapper or barrel.
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
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'renderConversationReplyPlanByIntegrationMode',
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

  it('keeps conversational-layer imports off the production wrapper', () => {
    const source = readFileSync(SEAM_SOURCE, 'utf8');

    expect(source.includes('generateBaselineConversationalReply')).toBe(false);
    expect(source).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );

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
      const expected = expectedActivatedBaselineReply(entry.replyPlan);
      const integrated = renderIntegratedConversationReplyPlan({
        plan: entry.replyPlan,
      });

      expect(integrated, entry.label).toBe(expected);
      expect(
        renderIntegratedConversationReplyPlan({ plan: entry.replyPlan }),
        `${entry.label} / repeat`,
      ).toBe(expected);
      if (expected === deterministic) {
        expect(integrated, `${entry.label} / deterministic parity`).toBe(
          deterministic,
        );
      } else {
        expect(integrated, `${entry.label} / intentional divergence`).not.toBe(
          deterministic,
        );
      }
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
    ).toBe(`${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`);

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
    const expected = expectedActivatedBaselineReply(replyPlan);

    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      expected,
    );
    expect(replyPlan).toEqual(before);
    expect(Object.isFrozen(replyPlan)).toBe(true);
  });
});
