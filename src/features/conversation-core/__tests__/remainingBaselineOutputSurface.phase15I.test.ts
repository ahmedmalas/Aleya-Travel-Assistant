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
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15I — remaining / complete baseline output-surface characterisation.
 *
 * Renderer-surface matrix after Phases 15B–15H (plan-level). Later phases add
 * 15J and distinguish production-reachable vs defensive-only shapes
 * (see Phase 15L / 15M). This file keeps exclusive-ownership coverage for the
 * full renderer surface, including shapes production does not currently emit.
 */

const ROOT = process.cwd();
const RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const UNKNOWN_FOLLOW_UP = 'Would you like a window seat preference noted?';

type BranchOwner =
  | '15B'
  | '15C'
  | '15J'
  | '15E-pass-through'
  | '15F'
  | '16B'
  | 'deterministic';

type SurfaceCase = {
  label: string;
  replyPlan: ConversationReplyPlan;
  owner: BranchOwner;
  /** When true, baseline must equal deterministic renderConversationReplyPlan. */
  passThroughOrDeterministic: boolean;
};

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

function freezePlan(replyPlan: ConversationReplyPlan): ConversationReplyPlan {
  return Object.freeze({
    ...replyPlan,
    acknowledgements: Object.freeze([...replyPlan.acknowledgements]),
  });
}

function classifyOwner(replyPlan: ConversationReplyPlan): BranchOwner {
  if (
    replyPlan.acknowledgements.length === 1 &&
    replyPlan.followUpQuestion === FOLLOW_UPS.neutralContinuation
  ) {
    return '16B';
  }
  if (
    replyPlan.acknowledgements.length === 1 &&
    replyPlan.followUpQuestion === null
  ) {
    return '15B';
  }
  if (
    replyPlan.acknowledgements.length === 1 &&
    replyPlan.followUpQuestion !== null
  ) {
    return '15C';
  }
  if (
    replyPlan.acknowledgements.length === 0 &&
    replyPlan.followUpQuestion === FOLLOW_UPS.neutralContinuation
  ) {
    return '15J';
  }
  if (
    replyPlan.acknowledgements.length === 0 &&
    replyPlan.followUpQuestion !== null
  ) {
    const followUp = replyPlan.followUpQuestion;
    if (
      followUp === FOLLOW_UPS.destination ||
      followUp === FOLLOW_UPS.origin ||
      followUp === FOLLOW_UPS.departureDate ||
      followUp === FOLLOW_UPS.returnDate ||
      followUp === FOLLOW_UPS.flightsAdultCount ||
      followUp === FOLLOW_UPS.accommodationGuestCount ||
      followUp === FOLLOW_UPS.activities ||
      followUp === FOLLOW_UPS.restaurants
    ) {
      return '15F';
    }
    return '15E-pass-through';
  }
  return 'deterministic';
}

const SURFACE_CASES: SurfaceCase[] = [
  // Already transformed categories (ownership anchors).
  {
    label: 'acknowledgement-only',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Cairns')],
      followUpQuestion: null,
      messageInterpreted: true,
    }),
    owner: '15B',
    passThroughOrDeterministic: false,
  },
  {
    label: 'acknowledgement + specific follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    }),
    owner: '15C',
    passThroughOrDeterministic: false,
  },
  {
    label: 'acknowledgement + neutral continuation',
    replyPlan: plan({
      acknowledgements: [ACKS.genericTravelFieldChange],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    }),
    owner: '16B',
    passThroughOrDeterministic: false,
  },
  {
    label: 'acknowledgement + unknown follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.destinationRemoved],
      followUpQuestion: UNKNOWN_FOLLOW_UP,
      messageInterpreted: true,
    }),
    owner: '15C',
    passThroughOrDeterministic: false,
  },
  {
    label: 'follow-up-only (supported / 15F)',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.activities,
      messageInterpreted: true,
    }),
    owner: '15F',
    passThroughOrDeterministic: false,
  },
  {
    label: 'neutral continuation only',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    }),
    owner: '15J',
    passThroughOrDeterministic: false,
  },
  {
    label: 'unknown follow-up only',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: UNKNOWN_FOLLOW_UP,
      messageInterpreted: true,
    }),
    owner: '15E-pass-through',
    passThroughOrDeterministic: true,
  },
  // Remaining / fall-through deterministic shapes.
  {
    label: 'empty reply plan',
    replyPlan: plan(),
    owner: 'deterministic',
    passThroughOrDeterministic: true,
  },
  {
    label: 'uninterpreted empty plan',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: null,
      messageInterpreted: false,
    }),
    owner: 'deterministic',
    passThroughOrDeterministic: true,
  },
  {
    label: 'uninterpreted neutral continuation',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: false,
    }),
    owner: '15J',
    passThroughOrDeterministic: false,
  },
  {
    label: 'multiple acknowledgements only',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      followUpQuestion: null,
      messageInterpreted: true,
    }),
    owner: 'deterministic',
    passThroughOrDeterministic: true,
  },
  {
    label: 'multiple acknowledgements + specific follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    }),
    owner: 'deterministic',
    passThroughOrDeterministic: true,
  },
  {
    label: 'multiple acknowledgements + neutral continuation',
    replyPlan: plan({
      acknowledgements: [
        ACKS.addedCapabilities('flights'),
        ACKS.destination('Brisbane'),
      ],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    }),
    owner: 'deterministic',
    passThroughOrDeterministic: true,
  },
  {
    label: 'multiple acknowledgements + unknown follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Hobart'), ACKS.originRemoved],
      followUpQuestion: UNKNOWN_FOLLOW_UP,
      messageInterpreted: true,
    }),
    owner: 'deterministic',
    passThroughOrDeterministic: true,
  },
];

describe('phase 15I — remaining baseline output surface characterisation', () => {
  it('keeps exclusive branch predicates in the baseline renderer', () => {
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');
    expect(renderer).toMatch(/acknowledgements\.length === 1/);
    expect(renderer).toMatch(/acknowledgements\.length === 0/);
    expect(renderer).toMatch(/transformBaselineAcknowledgement/);
    expect(renderer).toMatch(/renderBaselineAcknowledgementFollowUp/);
    expect(renderer).toMatch(/renderBaselineNeutralContinuation/);
    expect(renderer).toMatch(/renderBaselineFollowUpOnly/);
    expect(renderer).toMatch(/renderConversationReplyPlan\(plan\)/);

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

  it('characterises every reachable surface case with exclusive ownership', () => {
    expect(SURFACE_CASES.length).toBeGreaterThanOrEqual(14);

    const ownerCounts = {
      '15B': 0,
      '15C': 0,
      '16B': 0,
      '15J': 0,
      '15F': 0,
      '15E-pass-through': 0,
      deterministic: 0,
    };

    for (const entry of SURFACE_CASES) {
      const frozen = freezePlan(entry.replyPlan);
      const before = structuredClone(frozen);
      const owner = classifyOwner(frozen);
      expect(owner, entry.label).toBe(entry.owner);
      ownerCounts[owner] += 1;

      const deterministic = renderConversationReplyPlan(frozen);
      const expected = expectedActivatedBaselineReply(frozen);
      const baseline = generateBaselineConversationalReply(frozen);
      const production = renderIntegratedConversationReplyPlan({
        plan: frozen,
      });
      const layer = renderBaselineConversationalLayer(
        buildConversationalLayerInput(frozen),
      );

      expect(baseline, `${entry.label} / baseline`).toBe(expected);
      expect(production, `${entry.label} / production`).toBe(expected);
      expect(layer.wording, `${entry.label} / layer`).toBe(expected);
      expect(production, `${entry.label} / path agree`).toBe(baseline);

      if (entry.passThroughOrDeterministic) {
        expect(baseline, `${entry.label} / byte-identical`).toBe(deterministic);
        expect(baseline.includes("Let's start"), entry.label).toBe(false);
        expect(baseline.includes("Let's begin"), entry.label).toBe(false);
        expect(baseline.includes('Now for'), entry.label).toBe(false);
        // 15B/15C acknowledgement transforms must not apply to these shapes.
        if (frozen.acknowledgements.length !== 1) {
          expect(baseline.includes('Great, Cairns it is.'), entry.label).toBe(
            false,
          );
          expect(
            baseline.startsWith('Perfect, got it.'),
            entry.label,
          ).toBe(false);
        }
      } else {
        expect(baseline, `${entry.label} / diverges`).not.toBe(deterministic);
      }

      expect(frozen, `${entry.label} / unchanged`).toEqual(before);
    }

    expect(ownerCounts['15B']).toBeGreaterThan(0);
    expect(ownerCounts['15C']).toBeGreaterThan(0);
    expect(ownerCounts['16B']).toBeGreaterThan(0);
    expect(ownerCounts['15J']).toBeGreaterThan(0);
    expect(ownerCounts['15F']).toBeGreaterThan(0);
    expect(ownerCounts['15E-pass-through']).toBeGreaterThan(0);
    expect(ownerCounts.deterministic).toBeGreaterThan(0);
  });

  it('proves no ownership overlap between exclusive plan-shape predicates', () => {
    const shapes: ConversationReplyPlan[] = [
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
      }),
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
        followUpQuestion: null,
      }),
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
        followUpQuestion: FOLLOW_UPS.origin,
      }),
      plan({
        acknowledgements: [],
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
      }),
      plan({
        acknowledgements: [],
        followUpQuestion: FOLLOW_UPS.origin,
      }),
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.origin,
      }),
      plan(),
    ];

    const owners = shapes.map((shape) => classifyOwner(shape));
    expect(owners).toEqual([
      '16B',
      '15B',
      '15C',
      '15J',
      '15F',
      'deterministic',
      'deterministic',
    ]);

    // Multi-ack never enters single-ack transformers.
    const multi = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    const multiOut = generateBaselineConversationalReply(multi);
    expect(multiOut).toBe(renderConversationReplyPlan(multi));
    expect(multiOut).toBe(`${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}`);
    expect(multiOut).not.toBe(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')),
    );

    // Empty plan uses deterministic null-coalesce, not 15E.
    const empty = freezePlan(plan());
    expect(classifyOwner(empty)).toBe('deterministic');
    expect(generateBaselineConversationalReply(empty)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
    expect(empty.followUpQuestion).toBeNull();
  });
});
