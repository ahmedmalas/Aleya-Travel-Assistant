import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import {
  CONVERSATION_REPLY_CATALOGUE,
  NEUTRAL_TRIP_FALLBACK_REPLY,
} from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import {
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  renderBaselineNeutralContinuation,
} from '../renderBaselineNeutralContinuation';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15J — neutral-continuation conversational expression.
 *
 * Proves the dedicated neutral branch transforms only the canonical
 * zero-acknowledgement neutral prompt, preserves the question byte-for-byte,
 * and leaves neighbouring ownership categories unchanged.
 */

const ROOT = process.cwd();
const RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);
const HELPER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineNeutralContinuation.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const ACTIVATED_NEUTRAL =
  "There's just one more thing I'd like to know. What else should I know about your trip?";

const SUPPORTED_FOLLOW_UPS = [
  FOLLOW_UPS.destination,
  FOLLOW_UPS.origin,
  FOLLOW_UPS.departureDate,
  FOLLOW_UPS.returnDate,
  FOLLOW_UPS.flightsAdultCount,
  FOLLOW_UPS.accommodationGuestCount,
  FOLLOW_UPS.activities,
  FOLLOW_UPS.restaurants,
] as const;

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

function freezePlan(replyPlan: ConversationReplyPlan): ConversationReplyPlan {
  return Object.freeze({
    ...replyPlan,
    acknowledgements: Object.freeze([...replyPlan.acknowledgements]),
  });
}

describe('phase 15J — neutral-continuation conversational expression', () => {
  it('keeps the dedicated neutral branch before follow-up-only', () => {
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');
    const helper = readFileSync(HELPER_SOURCE, 'utf8');

    expect(helper).toMatch(/export function renderBaselineNeutralContinuation/);
    expect(helper).toContain(CANONICAL_NEUTRAL_CONTINUATION_PROMPT);
    expect(renderer).toMatch(/renderBaselineNeutralContinuation/);

    const branch16B = renderer.indexOf(
      'renderBaselineAcknowledgementNeutralContinuation({',
    );
    const branch15B = renderer.indexOf(
      'transformBaselineAcknowledgement(\n        plan.acknowledgements[0]!,\n        acknowledgementEvent,\n      )',
    );
    const branch15C = renderer.indexOf('renderBaselineAcknowledgementFollowUp({');
    const branch15J = renderer.indexOf('renderBaselineNeutralContinuation({');
    const branch15E = renderer.indexOf('renderBaselineFollowUpOnly({');
    const fallthrough = renderer.lastIndexOf(
      'renderConversationReplyPlan(plan)',
    );

    expect(branch16B).toBeGreaterThan(-1);
    expect(branch15B).toBeGreaterThan(branch16B);
    expect(branch15C).toBeGreaterThan(branch15B);
    expect(branch15J).toBeGreaterThan(branch15C);
    expect(branch15E).toBeGreaterThan(branch15J);
    expect(fallthrough).toBeGreaterThan(branch15E);
  });

  it('transforms canonical neutral continuation exactly and preserves the question', () => {
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(replyPlan);

    const helperOut = renderBaselineNeutralContinuation({
      followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
    });
    const baseline = generateBaselineConversationalReply(replyPlan);
    const production = renderIntegratedConversationReplyPlan({
      plan: replyPlan,
    });
    const layer = renderBaselineConversationalLayer(
      buildConversationalLayerInput(replyPlan),
    );
    const expected = expectedActivatedBaselineReply(replyPlan);

    expect(helperOut).toBe(ACTIVATED_NEUTRAL);
    expect(baseline).toBe(ACTIVATED_NEUTRAL);
    expect(production).toBe(ACTIVATED_NEUTRAL);
    expect(layer.wording).toBe(ACTIVATED_NEUTRAL);
    expect(expected).toBe(ACTIVATED_NEUTRAL);
    expect(production).toBe(baseline);
    expect(baseline).toBe(helperOut);

    expect(ACTIVATED_NEUTRAL.endsWith(CANONICAL_NEUTRAL_CONTINUATION_PROMPT)).toBe(
      true,
    );
    expect(
      ACTIVATED_NEUTRAL.slice(
        0,
        ACTIVATED_NEUTRAL.length - CANONICAL_NEUTRAL_CONTINUATION_PROMPT.length,
      ),
    ).toBe("There's just one more thing I'd like to know. ");
    expect(
      ACTIVATED_NEUTRAL.startsWith("There's just one more thing I'd like to know."),
    ).toBe(true);
    expect(
      "There's just one more thing I'd like to know.".endsWith('.'),
    ).toBe(true);

    // Deterministic renderer remains unchanged.
    expect(renderConversationReplyPlan(replyPlan)).toBe(
      CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
    );
    expect(baseline).not.toBe(renderConversationReplyPlan(replyPlan));
    expect(NEUTRAL_TRIP_FALLBACK_REPLY).toBe(
      CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
    );
    expect(FOLLOW_UPS.neutralContinuation).toBe(
      CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
    );
    expect(replyPlan).toEqual(before);
  });

  it('passes through non-matching strings from the helper', () => {
    const unknown = 'Would you like a window seat preference noted?';
    expect(
      renderBaselineNeutralContinuation({ followUpQuestion: unknown }),
    ).toBe(unknown);
    expect(
      renderBaselineNeutralContinuation({
        followUpQuestion: FOLLOW_UPS.destination,
      }),
    ).toBe(FOLLOW_UPS.destination);
  });

  it('leaves Phase 15F supported follow-ups and unknown follow-ups unchanged', () => {
    for (const followUp of SUPPORTED_FOLLOW_UPS) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [],
      acknowledgementEvent: null,
          followUpQuestion: followUp,
          messageInterpreted: true,
        }),
      );
      const expected = renderBaselineFollowUpOnly({ followUpQuestion: followUp });
      expect(generateBaselineConversationalReply(replyPlan)).toBe(expected);
      expect(expectedActivatedBaselineReply(replyPlan)).toBe(expected);
      expect(expected.endsWith(followUp)).toBe(true);
      expect(expected).not.toBe(ACTIVATED_NEUTRAL);
    }

    const unknown = 'Would you like a window seat preference noted?';
    const unknownPlan = freezePlan(
      plan({
        acknowledgements: [],
      acknowledgementEvent: null,
        followUpQuestion: unknown,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(unknownPlan)).toBe(unknown);
    expect(renderConversationReplyPlan(unknownPlan)).toBe(unknown);
  });

  it('preserves Phase 15B / 15C / deterministic ownership with no overlap', () => {
    const acknowledgementOnly = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
      acknowledgementEvent: null,
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(acknowledgementOnly)).toBe(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')),
    );

    const acknowledgementPlusNeutral = freezePlan(
      plan({
        acknowledgements: [ACKS.genericTravelFieldChange],
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
    );
    // Phase 16B owns one-ack + canonical neutral; 15J must not claim it.
    expect(
      generateBaselineConversationalReply(acknowledgementPlusNeutral),
    ).toBe(expectedActivatedBaselineReply(acknowledgementPlusNeutral));
    expect(
      generateBaselineConversationalReply(acknowledgementPlusNeutral),
    ).not.toBe(ACTIVATED_NEUTRAL);
    expect(
      generateBaselineConversationalReply(acknowledgementPlusNeutral),
    ).toContain(
      "Is there anything else you'd like me to consider?",
    );

    const acknowledgementPlusSpecific = freezePlan(
      plan({
        acknowledgements: [ACKS.origin('Sydney')],
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    expect(
      generateBaselineConversationalReply(acknowledgementPlusSpecific),
    ).toBe(expectedActivatedBaselineReply(acknowledgementPlusSpecific));
    expect(
      generateBaselineConversationalReply(acknowledgementPlusSpecific),
    ).not.toContain("There's just one more thing");

    const multiAck = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      acknowledgementEvent: null,
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(multiAck)).toBe(
      renderConversationReplyPlan(multiAck),
    );

    const multiAckNeutral = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(multiAckNeutral)).toBe(
      renderConversationReplyPlan(multiAckNeutral),
    );
    expect(generateBaselineConversationalReply(multiAckNeutral)).not.toBe(
      ACTIVATED_NEUTRAL,
    );

    const emptyPlan = freezePlan(plan());
    expect(emptyPlan.followUpQuestion).toBeNull();
    expect(generateBaselineConversationalReply(emptyPlan)).toBe(
      CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
    );
    expect(generateBaselineConversationalReply(emptyPlan)).toBe(
      renderConversationReplyPlan(emptyPlan),
    );
    expect(generateBaselineConversationalReply(emptyPlan)).not.toBe(
      ACTIVATED_NEUTRAL,
    );
  });
});
