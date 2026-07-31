import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import * as baselineModule from '../generateBaselineConversationalReply';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { renderConversationReplyPlanByIntegrationMode } from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 15B — acknowledgement-only conversational transformation.
 *
 * Proves eligible acknowledgement-only plans receive approved conversational
 * wording while all other plan shapes remain unchanged.
 */

const ROOT = process.cwd();
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
);
const RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);
const TRANSFORM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/transformBaselineAcknowledgement.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const DETERMINISTIC_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const BASELINE_MODE_CONST =
  /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/;

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

const ELIGIBLE_TRANSFORMATIONS: Array<{
  label: string;
  acknowledgement: string;
  transformed: string;
}> = [
  {
    label: 'field set/change — destination',
    acknowledgement: ACKS.destination('Cairns'),
    transformed: 'Great, Cairns it is.',
  },
  {
    label: 'field set/change — origin',
    acknowledgement: ACKS.origin('Sydney'),
    transformed: "Perfect, we'll start from Sydney.",
  },
  {
    label: 'field set/change — departure date',
    acknowledgement: ACKS.departureDate('2026-08-01'),
    transformed: 'Perfect, set to depart on 2026-08-01.',
  },
  {
    label: 'field set/change — return date',
    acknowledgement: ACKS.returnDate('2026-08-10'),
    transformed: 'Perfect, set to return on 2026-08-10.',
  },
  {
    label: 'field set/change — adult singular',
    acknowledgement: ACKS.adultCount(1),
    transformed: 'Perfect, 1 adult travelling.',
  },
  {
    label: 'field set/change — adult plural',
    acknowledgement: ACKS.adultCount(2),
    transformed: 'Perfect, 2 adults travelling.',
  },
  {
    label: 'field set/change — child singular',
    acknowledgement: ACKS.childCount(1),
    transformed: 'Perfect, 1 child travelling.',
  },
  {
    label: 'field set/change — child plural',
    acknowledgement: ACKS.childCount(3),
    transformed: 'Perfect, 3 children travelling.',
  },
  {
    label: 'field set/change — infant singular',
    acknowledgement: ACKS.infantCount(1),
    transformed: 'Perfect, 1 infant travelling.',
  },
  {
    label: 'field set/change — infant plural',
    acknowledgement: ACKS.infantCount(2),
    transformed: 'Perfect, 2 infants travelling.',
  },
  {
    label: 'field removal — destination',
    acknowledgement: ACKS.destinationRemoved,
    transformed: "No problem, I've removed the destination.",
  },
  {
    label: 'field removal — origin',
    acknowledgement: ACKS.originRemoved,
    transformed: "No problem, I've removed the departure location.",
  },
  {
    label: 'field removal — departure date',
    acknowledgement: ACKS.departureDateRemoved,
    transformed: "No problem, I've removed the departure date.",
  },
  {
    label: 'field removal — return date',
    acknowledgement: ACKS.returnDateRemoved,
    transformed: "No problem, I've removed the return date.",
  },
  {
    label: 'field removal — adult count',
    acknowledgement: ACKS.adultCountRemoved,
    transformed: "No problem, I've removed the adult count.",
  },
  {
    label: 'field removal — child count',
    acknowledgement: ACKS.childCountRemoved,
    transformed: "No problem, I've removed the child count.",
  },
  {
    label: 'field removal — infant count',
    acknowledgement: ACKS.infantCountRemoved,
    transformed: "No problem, I've removed the infant count.",
  },
  {
    label: 'capability enabled',
    acknowledgement: ACKS.addedCapabilities('flights'),
    transformed: "Great, I've added flights to your trip.",
  },
  {
    label: 'capability disabled',
    acknowledgement: ACKS.removedCapabilities('flights'),
    transformed: "No problem, I've removed flights from your trip.",
  },
  {
    label: 'generic acknowledgement',
    acknowledgement: ACKS.genericTravelFieldChange,
    transformed: 'Perfect, got it.',
  },
];

describe('phase 15B — baseline acknowledgement transformation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps production mode, pure transformer boundaries, and renderer eligibility wiring', () => {
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');
    const transform = readFileSync(TRANSFORM_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const deterministic = readFileSync(DETERMINISTIC_SOURCE, 'utf8');

    expect(seam).toMatch(BASELINE_MODE_CONST);
    expect(renderer).toMatch(/transformBaselineAcknowledgement/);
    expect(renderer).toMatch(/plan\.acknowledgements\.length === 1/);
    expect(renderer).toMatch(/plan\.followUpQuestion === null/);
    expect(deterministic.includes('transformBaselineAcknowledgement')).toBe(
      false,
    );
    expect(index.includes('transformBaselineAcknowledgement')).toBe(false);

    expect(
      transform.includes("from './conversationReplyCatalogue'"),
    ).toBe(false);
    expect(transform.includes('classifyConversationStateChange')).toBe(false);
    expect(transform.includes('Math.random')).toBe(false);
    expect(transform.includes('process.env')).toBe(false);
    expect(transform.includes('featureFlag')).toBe(false);
    expect(transform.includes('async ')).toBe(false);
    // No regex-based semantic inference — only string ops / exact maps.
    expect(transform.includes('new RegExp')).toBe(false);
    expect(transform.includes('.match(')).toBe(false);
    expect(transform.includes('.replace(')).toBe(false);
  });

  it('transforms every mapped acknowledgement-only category with approved wording', () => {
    for (const entry of ELIGIBLE_TRANSFORMATIONS) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [entry.acknowledgement],
          followUpQuestion: null,
          messageInterpreted: true,
        }),
      );
      const before = structuredClone(replyPlan);
      const deterministic = renderConversationReplyPlan(replyPlan);
      const baseline = generateBaselineConversationalReply(replyPlan);
      const production = renderIntegratedConversationReplyPlan({
        plan: replyPlan,
      });

      expect(transformBaselineAcknowledgement(entry.acknowledgement), entry.label).toBe(
        entry.transformed,
      );
      expect(deterministic, `${entry.label} / deterministic`).toBe(
        entry.acknowledgement,
      );
      expect(baseline, `${entry.label} / baseline`).toBe(entry.transformed);
      expect(production, `${entry.label} / production`).toBe(entry.transformed);
      expect(baseline, `${entry.label} / differs from deterministic`).not.toBe(
        deterministic,
      );
      expect(replyPlan, `${entry.label} / unchanged`).toEqual(before);

      const first = generateBaselineConversationalReply(replyPlan);
      const second = generateBaselineConversationalReply(replyPlan);
      expect(second, `${entry.label} / repeat`).toBe(first);
    }
  });

  it('leaves unknown acknowledgements and all ineligible plan shapes unchanged', () => {
    const unknown = 'Thanks for that travel note.';
    expect(transformBaselineAcknowledgement(unknown)).toBe(unknown);
    expect(
      generateBaselineConversationalReply(
        freezePlan(
          plan({
            acknowledgements: [unknown],
            followUpQuestion: null,
            messageInterpreted: true,
          }),
        ),
      ),
    ).toBe(unknown);

    const unchangedCases: Array<{
      label: string;
      replyPlan: ConversationReplyPlan;
      expected: string;
    }> = [
      {
        label: 'acknowledgement + follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
        expected: `${ACKS.destination('Brisbane')}\n${FOLLOW_UPS.origin}`,
      },
      {
        label: 'follow-up only',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.activities,
          messageInterpreted: true,
        }),
        expected: FOLLOW_UPS.activities,
      },
      {
        label: 'neutral continuation',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
        expected: NEUTRAL_TRIP_FALLBACK_REPLY,
      },
      {
        label: 'multiple acknowledgements',
        replyPlan: plan({
          acknowledgements: [
            ACKS.destination('Cairns'),
            ACKS.origin('Sydney'),
          ],
          followUpQuestion: null,
          messageInterpreted: true,
        }),
        expected: `${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}`,
      },
      {
        label: 'empty plan',
        replyPlan: plan(),
        expected: NEUTRAL_TRIP_FALLBACK_REPLY,
      },
      {
        label: 'uninterpreted message',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: false,
        }),
        expected: NEUTRAL_TRIP_FALLBACK_REPLY,
      },
    ];

    for (const entry of unchangedCases) {
      const frozen = freezePlan(entry.replyPlan);
      const before = structuredClone(frozen);
      const deterministic = renderConversationReplyPlan(frozen);
      const baseline = generateBaselineConversationalReply(frozen);
      const production = renderIntegratedConversationReplyPlan({
        plan: frozen,
      });
      const objectiveBefore = selectConversationalObjective(frozen);
      const input = buildConversationalLayerInput(frozen);
      const inputBefore = structuredClone(input);

      expect(deterministic, entry.label).toBe(entry.expected);
      expect(baseline, `${entry.label} / baseline`).toBe(entry.expected);
      expect(production, `${entry.label} / production`).toBe(entry.expected);
      expect(selectConversationalObjective(frozen), entry.label).toEqual(
        objectiveBefore,
      );
      expect(frozen, `${entry.label} / plan`).toEqual(before);
      expect(input, `${entry.label} / input`).toEqual(inputBefore);
    }

    // Required follow-up selection remains visible and unchanged on mixed plans.
    const withFollowUp = freezePlan(
      plan({
        acknowledgements: [ACKS.addedCapabilities('flights')],
        followUpQuestion: FOLLOW_UPS.flightsAdultCount,
        messageInterpreted: true,
      }),
    );
    expect(selectConversationalObjective(withFollowUp)).toEqual({
      id: 'flightsAdultCount',
      catalogueWording: FOLLOW_UPS.flightsAdultCount,
    });
    expect(generateBaselineConversationalReply(withFollowUp)).toBe(
      `${ACKS.addedCapabilities('flights')}\n${FOLLOW_UPS.flightsAdultCount}`,
    );
  });

  it('preserves deterministic renderer output, immutability, and fallback on forced failure', () => {
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Hobart')],
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(replyPlan);
    const deterministic = renderConversationReplyPlan(replyPlan);
    expect(deterministic).toBe(ACKS.destination('Hobart'));
    expect(generateBaselineConversationalReply(replyPlan)).toBe(
      'Great, Hobart it is.',
    );
    expect(replyPlan).toEqual(before);

    const input = buildConversationalLayerInput(replyPlan);
    const inputBefore = structuredClone(input);
    expect(generateBaselineConversationalReply(replyPlan)).toBe(
      'Great, Hobart it is.',
    );
    expect(input).toEqual(inputBefore);
    expect(Object.isFrozen(input)).toBe(true);

    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      expect(receivedPlan).toBe(replyPlan);
      throw new Error('forced-baseline-failure:15b');
    });

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: replyPlan,
        mode: 'baseline-conversational',
      }),
    ).toBe(deterministic);
    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      deterministic,
    );
    expect(replyPlan).toEqual(before);
  });
});
