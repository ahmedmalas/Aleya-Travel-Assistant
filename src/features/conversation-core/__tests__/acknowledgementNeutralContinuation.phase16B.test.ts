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
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { renderBaselineAcknowledgementNeutralContinuation } from '../renderBaselineAcknowledgementNeutralContinuation';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  renderBaselineNeutralContinuation,
} from '../renderBaselineNeutralContinuation';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 16B — acknowledgement-plus-canonical-neutral bridge expression.
 */

const ROOT = process.cwd();
const RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);
const HELPER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineAcknowledgementNeutralContinuation.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const BRIDGE_FIELD_SET =
  "Is there anything else you'd like me to consider?";
const BRIDGE_FIELD_REMOVED = 'We can update the rest as we go.';
const BRIDGE_CAPABILITY_ENABLED =
  'Tell me anything else that matters for this trip.';
const BRIDGE_CAPABILITY_DISABLED = 'We can keep refining the plan.';
const BRIDGE_GENERIC = "Is there anything else you'd like me to consider?";

const CATEGORY_CASES: Array<{
  label: string;
  acknowledgement: string;
  bridge: string | null;
}> = [
  {
    label: 'field set/change',
    acknowledgement: ACKS.returnDate('2026-09-05'),
    bridge: BRIDGE_FIELD_SET,
  },
  {
    label: 'field removal',
    acknowledgement: ACKS.destinationRemoved,
    bridge: BRIDGE_FIELD_REMOVED,
  },
  {
    label: 'capability enabled',
    acknowledgement: ACKS.addedCapabilities('beaches'),
    bridge: BRIDGE_CAPABILITY_ENABLED,
  },
  {
    label: 'capability disabled',
    acknowledgement: ACKS.removedCapabilities('flights'),
    bridge: BRIDGE_CAPABILITY_DISABLED,
  },
  {
    label: 'generic acknowledgement',
    acknowledgement: ACKS.genericTravelFieldChange,
    bridge: BRIDGE_GENERIC,
  },
  {
    label: 'unknown acknowledgement',
    acknowledgement: 'Thanks for that travel note.',
    bridge: null,
  },
];

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

function expectedBridgeReply(
  acknowledgement: string,
  bridge: string | null,
): string {
  const transformed = transformBaselineAcknowledgement(acknowledgement);
  if (bridge === null) {
    return `${transformed} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`;
  }
  return `${transformed} ${bridge} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`;
}

describe('phase 16B — acknowledgement-plus-neutral continuation', () => {
  it('keeps Phase 16B before 15B/15C/15J/15E and after eligibility for canonical neutral', () => {
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');
    const helper = readFileSync(HELPER_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');

    expect(helper).toMatch(
      /export function renderBaselineAcknowledgementNeutralContinuation/,
    );
    expect(helper).toMatch(/CANONICAL_NEUTRAL_CONTINUATION_PROMPT/);
    expect(helper).toMatch(/transformBaselineAcknowledgement\(/);
    expect(index.includes('renderBaselineAcknowledgementNeutralContinuation')).toBe(
      false,
    );

    const branch16B = renderer.indexOf(
      'renderBaselineAcknowledgementNeutralContinuation({',
    );
    const branch15B = renderer.indexOf(
      'transformBaselineAcknowledgement(plan.acknowledgements[0]!)',
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

  it('applies exact category bridges and preserves the canonical neutral trailing substring', () => {
    for (const entry of CATEGORY_CASES) {
      const expected = expectedBridgeReply(entry.acknowledgement, entry.bridge);
      const helperOutput = renderBaselineAcknowledgementNeutralContinuation({
        acknowledgement: entry.acknowledgement,
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      });
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [entry.acknowledgement],
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      );
      const layerOutput = renderIntegratedConversationReplyPlan({
        plan: replyPlan,
      });
      const productionOutput = generateBaselineConversationalReply(replyPlan);

      expect(helperOutput).toBe(expected);
      expect(layerOutput).toBe(expected);
      expect(productionOutput).toBe(expected);
      expect(expectedActivatedBaselineReply(replyPlan)).toBe(expected);

      expect(helperOutput.endsWith(CANONICAL_NEUTRAL_CONTINUATION_PROMPT)).toBe(
        true,
      );
      expect(
        helperOutput.slice(
          helperOutput.length - CANONICAL_NEUTRAL_CONTINUATION_PROMPT.length,
        ),
      ).toBe(CANONICAL_NEUTRAL_CONTINUATION_PROMPT);

      const transformed = transformBaselineAcknowledgement(entry.acknowledgement);
      expect(helperOutput.startsWith(transformed)).toBe(true);
      expect(helperOutput.includes(`${transformed} ${transformed}`)).toBe(false);
      expect(
        helperOutput.split(CANONICAL_NEUTRAL_CONTINUATION_PROMPT).length - 1,
      ).toBe(1);
      expect(helperOutput.includes('\n')).toBe(false);
      expect(helperOutput.includes('  ')).toBe(false);

      if (entry.bridge === null) {
        expect(helperOutput).toBe(
          `${transformed} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`,
        );
        expect(helperOutput.includes(BRIDGE_FIELD_SET)).toBe(false);
        expect(helperOutput.includes(BRIDGE_FIELD_REMOVED)).toBe(false);
        expect(helperOutput.includes(BRIDGE_CAPABILITY_ENABLED)).toBe(false);
        expect(helperOutput.includes(BRIDGE_CAPABILITY_DISABLED)).toBe(false);
      } else {
        expect(helperOutput).toBe(
          `${transformed} ${entry.bridge} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`,
        );
      }
    }
  });

  it('leaves one-ack + specific follow-up on Phase 15C unchanged', () => {
    const acknowledgement = ACKS.destination('Cairns');
    const followUpQuestion = FOLLOW_UPS.origin;
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [acknowledgement],
      acknowledgementEvent: null,
        followUpQuestion,
        messageInterpreted: true,
      }),
    );
    const expected = renderBaselineAcknowledgementFollowUp({
      acknowledgement,
      followUpQuestion,
    });

    expect(generateBaselineConversationalReply(replyPlan)).toBe(expected);
    expect(
      renderBaselineAcknowledgementNeutralContinuation({
        acknowledgement,
        followUpQuestion,
      }),
    ).toBe(expected);
    expect(expected).toBe(
      `${transformBaselineAcknowledgement(acknowledgement)} ${followUpQuestion}`,
    );
    expect(expected.includes(BRIDGE_FIELD_SET)).toBe(false);
  });

  it('leaves acknowledgement-only on Phase 15B unchanged', () => {
    const acknowledgement = ACKS.genericTravelFieldChange;
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [acknowledgement],
      acknowledgementEvent: null,
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    const expected = transformBaselineAcknowledgement(acknowledgement);

    expect(generateBaselineConversationalReply(replyPlan)).toBe(expected);
    expect(buildConversationalLayerInput(replyPlan).plan).toEqual(replyPlan);
  });

  it('leaves zero-ack neutral on Phase 15J unchanged', () => {
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [],
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: false,
      }),
    );
    expect(generateBaselineConversationalReply(replyPlan)).toBe(
      ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
    );
    expect(
      renderBaselineNeutralContinuation({
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      }),
    ).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
  });

  it('leaves zero-ack supported follow-ups on Phase 15F unchanged', () => {
    for (const followUpQuestion of SUPPORTED_FOLLOW_UPS) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [],
      acknowledgementEvent: null,
          followUpQuestion,
          messageInterpreted: true,
        }),
      );
      const expected = renderBaselineFollowUpOnly({ followUpQuestion });
      expect(generateBaselineConversationalReply(replyPlan)).toBe(expected);
    }
  });

  it('keeps multi-ack and empty renderer shapes deterministic', () => {
    const multi = freezePlan(
      plan({
        acknowledgements: [
          ACKS.destination('Cairns'),
          ACKS.origin('Sydney'),
        ],
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(multi)).toBe(
      renderConversationReplyPlan(multi),
    );

    const empty = freezePlan(
      plan({
        acknowledgements: [],
      acknowledgementEvent: null,
        followUpQuestion: null,
        messageInterpreted: false,
      }),
    );
    expect(generateBaselineConversationalReply(empty)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
  });
});
