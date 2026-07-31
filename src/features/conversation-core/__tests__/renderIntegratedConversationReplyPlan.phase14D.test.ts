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
 * Phase 14D — plan-level reply rendering seam characterisation.
 *
 * Proves ConversationReplyPlan → renderIntegratedConversationReplyPlan is a
 * pure delegate through the activated baseline mode, free of conversational-layer
 * imports, and not exported from the barrel. Production wiring belongs to
 * generateConversationReply (Phase 14E), not processTurn or the state seam.
 */

const ROOT = process.cwd();
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
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

describe('phase 14D — renderIntegratedConversationReplyPlan', () => {
  it('is an isolated plan-level seam with no assembly or conversational wiring', () => {
    const source = readFileSync(SEAM_SOURCE, 'utf8');

    expect(source).toMatch(
      /export function renderIntegratedConversationReplyPlan/,
    );
    expect(source).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(source).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode,\s*\}\)/,
    );
    expect(source).toMatch(
      /export type RenderIntegratedConversationReplyPlanInput/,
    );
    expect(source).toMatch(
      /from '\.\/renderConversationReplyPlanByIntegrationMode'/,
    );

    expect(source.includes('classifyConversationStateChange')).toBe(false);
    expect(source.includes('createConversationReplyPlan')).toBe(false);
    expect(source.includes('assembleConversationReplyPlan(')).toBe(false);
    expect(source.includes('selectConversationReplyComponents')).toBe(false);
    expect(source.includes("from './generateConversationReply'")).toBe(false);
    expect(source.includes("from './generateBaselineConversationalReply'")).toBe(
      false,
    );
    expect(source.includes('generateConversationReply(')).toBe(false);
    expect(source.includes('generateIntegratedConversationReply')).toBe(false);
    expect(source.includes('generateBaselineConversationalReply')).toBe(false);
    expect(source.includes('buildConversationalLayerInput')).toBe(false);
    expect(source.includes('renderBaselineConversational')).toBe(false);
    expect(source.includes('ConversationalLayer')).toBe(false);
    expect(source.includes('featureFlag')).toBe(false);
    expect(source.includes('process.env')).toBe(false);
    expect(source.includes('if (')).toBe(false);
    expect(source.includes('switch (')).toBe(false);

    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'renderIntegratedConversationReplyPlan',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'renderIntegratedConversationReplyPlan',
      ),
    ).toBe(false);
    expect(
      readFileSync(INTEGRATED_REPLY_SOURCE, 'utf8').includes(
        'renderIntegratedConversationReplyPlan',
      ),
    ).toBe(false);
  });

  it('delegates with exact parity for acknowledgement, follow-up, continuation, and capability plans', () => {
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

    expect(
      renderIntegratedConversationReplyPlan({
        plan: plan({
          acknowledgements: [ACKS.addedCapabilities('flights')],
          followUpQuestion: FOLLOW_UPS.flightsAdultCount,
          messageInterpreted: true,
        }),
      }),
    ).toBe(
      `${transformBaselineAcknowledgement(ACKS.addedCapabilities('flights'))} ${FOLLOW_UPS.flightsAdultCount}`,
    );

    expect(
      renderIntegratedConversationReplyPlan({
        plan: plan({
          acknowledgements: [ACKS.removedCapabilities('flights')],
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      }),
    ).toBe(
      `${transformBaselineAcknowledgement(ACKS.removedCapabilities('flights'))} ${FOLLOW_UPS.neutralContinuation}`,
    );
  });

  it('does not mutate a frozen plan', () => {
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
