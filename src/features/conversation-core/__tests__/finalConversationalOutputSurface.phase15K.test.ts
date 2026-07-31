import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  renderBaselineNeutralContinuation,
} from '../renderBaselineNeutralContinuation';
import { renderConversationReplyPlanByIntegrationMode } from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15K — final Phase 15 baseline-conversational output-surface audit.
 *
 * Characterization / completion-proof only. Proves exclusive ownership,
 * byte-preservation contracts, path agreement, and deterministic fallback
 * boundaries after Phase 15J.
 */

const ROOT = process.cwd();
const LAYER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);
const INTEGRATED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
);
const MODE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
);
const GENERATOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateBaselineConversationalReply.ts',
);
const TRANSFORM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/transformBaselineAcknowledgement.ts',
);
const ACK_FOLLOW_UP_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineAcknowledgementFollowUp.ts',
);
const FOLLOW_UP_ONLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineFollowUpOnly.ts',
);
const NEUTRAL_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineNeutralContinuation.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const UNKNOWN_FOLLOW_UP = 'Would you like a window seat preference noted?';

type Owner =
  | '15B'
  | '15C'
  | '15J'
  | '15F'
  | '15E-pass-through'
  | 'deterministic';

type MatrixRow = {
  label: string;
  replyPlan: ConversationReplyPlan;
  owner: Owner;
  renderer: string;
  transformed: boolean;
  exactOutput: string;
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

function classifyOwner(replyPlan: ConversationReplyPlan): Owner {
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
    replyPlan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
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

const MATRIX: MatrixRow[] = [
  {
    label: 'acknowledgement-only',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Cairns')],
      followUpQuestion: null,
      messageInterpreted: true,
    }),
    owner: '15B',
    renderer: 'transformBaselineAcknowledgement',
    transformed: true,
    exactOutput: transformBaselineAcknowledgement(ACKS.destination('Cairns')),
  },
  {
    label: 'acknowledgement + specific follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    }),
    owner: '15C',
    renderer: 'renderBaselineAcknowledgementFollowUp',
    transformed: true,
    exactOutput: renderBaselineAcknowledgementFollowUp({
      acknowledgement: ACKS.origin('Sydney'),
      followUpQuestion: FOLLOW_UPS.departureDate,
    }),
  },
  {
    label: 'acknowledgement + neutral follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.genericTravelFieldChange],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    }),
    owner: '15C',
    renderer: 'renderBaselineAcknowledgementFollowUp',
    transformed: true,
    exactOutput: renderBaselineAcknowledgementFollowUp({
      acknowledgement: ACKS.genericTravelFieldChange,
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
    }),
  },
  {
    label: 'acknowledgement + unknown follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.destinationRemoved],
      followUpQuestion: UNKNOWN_FOLLOW_UP,
      messageInterpreted: true,
    }),
    owner: '15C',
    renderer: 'renderBaselineAcknowledgementFollowUp',
    transformed: true,
    exactOutput: renderBaselineAcknowledgementFollowUp({
      acknowledgement: ACKS.destinationRemoved,
      followUpQuestion: UNKNOWN_FOLLOW_UP,
    }),
  },
  {
    label: 'supported follow-up-only',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.activities,
      messageInterpreted: true,
    }),
    owner: '15F',
    renderer: 'renderBaselineFollowUpOnly',
    transformed: true,
    exactOutput: renderBaselineFollowUpOnly({
      followUpQuestion: FOLLOW_UPS.activities,
    }),
  },
  {
    label: 'neutral continuation',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    }),
    owner: '15J',
    renderer: 'renderBaselineNeutralContinuation',
    transformed: true,
    exactOutput: ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  },
  {
    label: 'unknown follow-up-only',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: UNKNOWN_FOLLOW_UP,
      messageInterpreted: true,
    }),
    owner: '15E-pass-through',
    renderer: 'renderBaselineFollowUpOnly',
    transformed: false,
    exactOutput: UNKNOWN_FOLLOW_UP,
  },
  {
    label: 'multiple acknowledgements without follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      followUpQuestion: null,
      messageInterpreted: true,
    }),
    owner: 'deterministic',
    renderer: 'renderConversationReplyPlan',
    transformed: false,
    exactOutput: `${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}`,
  },
  {
    label: 'multiple acknowledgements + specific follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    }),
    owner: 'deterministic',
    renderer: 'renderConversationReplyPlan',
    transformed: false,
    exactOutput: `${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}\n${FOLLOW_UPS.departureDate}`,
  },
  {
    label: 'multiple acknowledgements + neutral follow-up',
    replyPlan: plan({
      acknowledgements: [
        ACKS.addedCapabilities('flights'),
        ACKS.destination('Brisbane'),
      ],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    }),
    owner: 'deterministic',
    renderer: 'renderConversationReplyPlan',
    transformed: false,
    exactOutput: `${ACKS.addedCapabilities('flights')} ${ACKS.destination('Brisbane')}\n${FOLLOW_UPS.neutralContinuation}`,
  },
  {
    label: 'empty plan',
    replyPlan: plan(),
    owner: 'deterministic',
    renderer: 'renderConversationReplyPlan',
    transformed: false,
    exactOutput: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  },
  {
    label: 'uninterpreted empty plan',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: null,
      messageInterpreted: false,
    }),
    owner: 'deterministic',
    renderer: 'renderConversationReplyPlan',
    transformed: false,
    exactOutput: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  },
];

describe('phase 15K — final conversational output surface audit', () => {
  it('traces the production path and final exclusive branch order', () => {
    const integrated = readFileSync(INTEGRATED_SOURCE, 'utf8');
    const mode = readFileSync(MODE_SOURCE, 'utf8');
    const generator = readFileSync(GENERATOR_SOURCE, 'utf8');
    const layer = readFileSync(LAYER_SOURCE, 'utf8');

    expect(integrated).toMatch(/'baseline-conversational'/);
    expect(integrated).toMatch(/renderConversationReplyPlanByIntegrationMode/);
    expect(mode).toMatch(/generateBaselineConversationalReply\(input\.plan\)/);
    expect(mode).toMatch(/catch/);
    expect(mode).toMatch(/renderConversationReplyPlan\(input\.plan\)/);
    expect(generator).toMatch(/renderBaselineConversationalReplyPlan/);

    const branch15B = layer.indexOf(
      'transformBaselineAcknowledgement(plan.acknowledgements[0]!)',
    );
    const branch15C = layer.indexOf('renderBaselineAcknowledgementFollowUp({');
    const branch15J = layer.indexOf('renderBaselineNeutralContinuation({');
    const branch15E = layer.indexOf('renderBaselineFollowUpOnly({');
    const fallthrough = layer.lastIndexOf('renderConversationReplyPlan(plan)');

    expect(branch15B).toBeGreaterThan(-1);
    expect(branch15C).toBeGreaterThan(branch15B);
    expect(branch15J).toBeGreaterThan(branch15C);
    expect(branch15E).toBeGreaterThan(branch15J);
    expect(fallthrough).toBeGreaterThan(branch15E);

    // Conversational-layer helpers do not perform catalogue selection,
    // priority, trip-state inspection, or reply-plan assembly.
    for (const source of [
      layer,
      readFileSync(TRANSFORM_SOURCE, 'utf8'),
      readFileSync(ACK_FOLLOW_UP_SOURCE, 'utf8'),
      readFileSync(FOLLOW_UP_ONLY_SOURCE, 'utf8'),
      readFileSync(NEUTRAL_SOURCE, 'utf8'),
    ]) {
      expect(source.includes('selectConversationFollowUpQuestion')).toBe(false);
      expect(source.includes('selectConversationAcknowledgement')).toBe(false);
      expect(source.includes('selectConversationContinuationPrompt')).toBe(
        false,
      );
      expect(source.includes('createConversationReplyPlan')).toBe(false);
      expect(source.includes('assembleConversationReplyPlan')).toBe(false);
      expect(source.includes('classifyConversationStateChange')).toBe(false);
      expect(source.includes('conversationReplyCatalogue')).toBe(false);
    }
  });

  it('audits the complete output-surface matrix with exclusive ownership', () => {
    expect(MATRIX).toHaveLength(12);

    const ownersSeen = new Set<Owner>();

    for (const row of MATRIX) {
      const frozen = freezePlan(row.replyPlan);
      const before = structuredClone(frozen);
      const owner = classifyOwner(frozen);
      expect(owner, row.label).toBe(row.owner);
      ownersSeen.add(owner);

      const deterministic = renderConversationReplyPlan(frozen);
      const expected = expectedActivatedBaselineReply(frozen);
      const baseline = generateBaselineConversationalReply(frozen);
      const production = renderIntegratedConversationReplyPlan({
        plan: frozen,
      });
      const viaMode = renderConversationReplyPlanByIntegrationMode({
        plan: frozen,
        mode: 'baseline-conversational',
      });
      const layer = renderBaselineConversationalLayer(
        buildConversationalLayerInput(frozen),
      );

      expect(expected, `${row.label} / helper`).toBe(row.exactOutput);
      expect(baseline, `${row.label} / baseline`).toBe(row.exactOutput);
      expect(production, `${row.label} / production`).toBe(row.exactOutput);
      expect(viaMode, `${row.label} / mode`).toBe(row.exactOutput);
      expect(layer.wording, `${row.label} / layer`).toBe(row.exactOutput);
      expect(production, `${row.label} / path agree`).toBe(baseline);

      if (row.transformed) {
        expect(baseline, `${row.label} / diverges`).not.toBe(deterministic);
      } else {
        expect(baseline, `${row.label} / deterministic`).toBe(deterministic);
      }

      expect(frozen, `${row.label} / unchanged`).toEqual(before);
    }

    expect(ownersSeen).toEqual(
      new Set<Owner>([
        '15B',
        '15C',
        '15J',
        '15F',
        '15E-pass-through',
        'deterministic',
      ]),
    );
  });

  it('proves mutually exclusive branch predicates and no ownership overlap', () => {
    const shapes: ConversationReplyPlan[] = [
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
        acknowledgements: [],
        followUpQuestion: UNKNOWN_FOLLOW_UP,
      }),
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.origin,
      }),
      plan(),
    ];

    expect(shapes.map((shape) => classifyOwner(shape))).toEqual([
      '15B',
      '15C',
      '15J',
      '15F',
      '15E-pass-through',
      'deterministic',
      'deterministic',
    ]);

    // Multi-ack never enters single-ack or zero-ack transformers.
    const multi = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
    );
    expect(classifyOwner(multi)).toBe('deterministic');
    expect(generateBaselineConversationalReply(multi)).toBe(
      renderConversationReplyPlan(multi),
    );
    expect(generateBaselineConversationalReply(multi)).not.toContain(
      "There's just one more thing",
    );
    expect(generateBaselineConversationalReply(multi)).not.toBe(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')),
    );
  });

  it('proves byte-preservation contracts by owning phase', () => {
    // 15B — acknowledgement-only transform remains the sole wording.
    const ackOnly = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(ackOnly)).toBe(
      'Great, Cairns it is.',
    );
    expect(generateBaselineConversationalReply(ackOnly)).toBe(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')),
    );

    // 15C — every follow-up remains a byte-identical trailing substring.
    const followUps = [
      FOLLOW_UPS.departureDate,
      FOLLOW_UPS.neutralContinuation,
      UNKNOWN_FOLLOW_UP,
    ];
    for (const followUp of followUps) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [ACKS.origin('Sydney')],
          followUpQuestion: followUp,
          messageInterpreted: true,
        }),
      );
      const wording = generateBaselineConversationalReply(replyPlan);
      expect(wording.endsWith(followUp), followUp).toBe(true);
      expect(
        wording.slice(0, wording.length - followUp.length),
        followUp,
      ).toBe(`${transformBaselineAcknowledgement(ACKS.origin('Sydney'))} `);
      expect(wording.includes('\n'), followUp).toBe(false);
    }

    // 15F — each supported question remains a byte-identical trailing substring.
    const supported = [
      FOLLOW_UPS.destination,
      FOLLOW_UPS.origin,
      FOLLOW_UPS.departureDate,
      FOLLOW_UPS.returnDate,
      FOLLOW_UPS.flightsAdultCount,
      FOLLOW_UPS.accommodationGuestCount,
      FOLLOW_UPS.activities,
      FOLLOW_UPS.restaurants,
    ];
    for (const followUp of supported) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [],
          followUpQuestion: followUp,
          messageInterpreted: true,
        }),
      );
      const wording = generateBaselineConversationalReply(replyPlan);
      expect(wording.endsWith(followUp), followUp).toBe(true);
      expect(wording, followUp).toBe(
        renderBaselineFollowUpOnly({ followUpQuestion: followUp }),
      );
      expect(wording, followUp).not.toBe(followUp);
    }

    // 15J — canonical neutral question preserved byte-for-byte.
    const neutral = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
        messageInterpreted: true,
      }),
    );
    const neutralOut = generateBaselineConversationalReply(neutral);
    expect(neutralOut).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
    expect(neutralOut.endsWith(CANONICAL_NEUTRAL_CONTINUATION_PROMPT)).toBe(
      true,
    );
    expect(
      renderBaselineNeutralContinuation({
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      }),
    ).toBe(neutralOut);

    // Unknown follow-up-only remains unchanged.
    const unknown = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: UNKNOWN_FOLLOW_UP,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(unknown)).toBe(UNKNOWN_FOLLOW_UP);
    expect(renderConversationReplyPlan(unknown)).toBe(UNKNOWN_FOLLOW_UP);

    // Empty / uninterpreted-empty remain deterministic null-coalesce.
    for (const replyPlan of [
      freezePlan(plan()),
      freezePlan(
        plan({
          acknowledgements: [],
          followUpQuestion: null,
          messageInterpreted: false,
        }),
      ),
    ]) {
      expect(replyPlan.followUpQuestion).toBeNull();
      expect(generateBaselineConversationalReply(replyPlan)).toBe(
        CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      );
      expect(generateBaselineConversationalReply(replyPlan)).toBe(
        renderConversationReplyPlan(replyPlan),
      );
      expect(generateBaselineConversationalReply(replyPlan)).not.toBe(
        ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
      );
    }
  });
});
