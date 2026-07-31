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
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { renderConversationReplyPlanByIntegrationMode } from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15C — acknowledgement-plus-follow-up transition characterisation.
 *
 * Proves eligible ack+follow-up plans transform only the acknowledgement
 * expression while preserving the follow-up byte-for-byte.
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
const FOLLOW_UP_RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineAcknowledgementFollowUp.ts',
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

function expectedTransition(
  acknowledgement: string,
  followUpQuestion: string,
): string {
  return `${transformBaselineAcknowledgement(acknowledgement)} ${followUpQuestion}`;
}

const ELIGIBLE_CASES: Array<{
  label: string;
  acknowledgement: string;
  followUpQuestion: string;
  expectedObjectiveId: string;
}> = [
  {
    label: 'destination set/change',
    acknowledgement: ACKS.destination('Cairns'),
    followUpQuestion: FOLLOW_UPS.origin,
    expectedObjectiveId: 'origin',
  },
  {
    label: 'origin set/change',
    acknowledgement: ACKS.origin('Sydney'),
    followUpQuestion: FOLLOW_UPS.departureDate,
    expectedObjectiveId: 'departureDate',
  },
  {
    label: 'date set/change',
    acknowledgement: ACKS.departureDate('2026-08-01'),
    followUpQuestion: FOLLOW_UPS.returnDate,
    expectedObjectiveId: 'returnDate',
  },
  {
    label: 'passenger count set/change',
    acknowledgement: ACKS.adultCount(2),
    followUpQuestion: FOLLOW_UPS.activities,
    expectedObjectiveId: 'activities',
  },
  {
    label: 'field removal',
    acknowledgement: ACKS.destinationRemoved,
    followUpQuestion: FOLLOW_UPS.destination,
    expectedObjectiveId: 'destination',
  },
  {
    label: 'capability enabled',
    acknowledgement: ACKS.addedCapabilities('flights'),
    followUpQuestion: FOLLOW_UPS.flightsAdultCount,
    expectedObjectiveId: 'flightsAdultCount',
  },
  {
    label: 'capability disabled',
    acknowledgement: ACKS.removedCapabilities('flights'),
    followUpQuestion: FOLLOW_UPS.neutralContinuation,
    expectedObjectiveId: 'neutralContinuation',
  },
  {
    label: 'generic acknowledgement',
    acknowledgement: ACKS.genericTravelFieldChange,
    followUpQuestion: FOLLOW_UPS.origin,
    expectedObjectiveId: 'origin',
  },
  {
    label: 'unknown acknowledgement',
    acknowledgement: 'Thanks for that travel note.',
    followUpQuestion: FOLLOW_UPS.origin,
    expectedObjectiveId: 'origin',
  },
];

describe('phase 15C — baseline acknowledgement follow-up transformation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps production mode and wires the ack+follow-up branch after Phase 15B', () => {
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');
    const followUpRenderer = readFileSync(FOLLOW_UP_RENDERER_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const deterministic = readFileSync(DETERMINISTIC_SOURCE, 'utf8');

    expect(seam).toMatch(BASELINE_MODE_CONST);
    expect(renderer).toMatch(/transformBaselineAcknowledgement/);
    expect(renderer).toMatch(/renderBaselineAcknowledgementFollowUp/);
    expect(renderer.indexOf('followUpQuestion === null')).toBeLessThan(
      renderer.indexOf('followUpQuestion !== null'),
    );
    expect(followUpRenderer).toMatch(/transformBaselineAcknowledgement\(/);
    expect(followUpRenderer).toMatch(
      /\$\{transformedAcknowledgement\} \$\{input\.followUpQuestion\}/,
    );
    expect(followUpRenderer.includes('Now,')).toBe(false);
    expect(followUpRenderer.includes('Next,')).toBe(false);
    expect(followUpRenderer.includes('Also,')).toBe(false);
    expect(deterministic.includes('renderBaselineAcknowledgementFollowUp')).toBe(
      false,
    );
    expect(index.includes('renderBaselineAcknowledgementFollowUp')).toBe(false);
  });

  it('transforms acknowledgement expression while preserving follow-up byte-for-byte', () => {
    for (const entry of ELIGIBLE_CASES) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [entry.acknowledgement],
          followUpQuestion: entry.followUpQuestion,
          messageInterpreted: true,
        }),
      );
      const before = structuredClone(replyPlan);
      const deterministic = renderConversationReplyPlan(replyPlan);
      const expected = expectedTransition(
        entry.acknowledgement,
        entry.followUpQuestion,
      );
      const viaHelper = renderBaselineAcknowledgementFollowUp({
        acknowledgement: entry.acknowledgement,
        followUpQuestion: entry.followUpQuestion,
      });
      const baseline = generateBaselineConversationalReply(replyPlan);
      const production = renderIntegratedConversationReplyPlan({
        plan: replyPlan,
      });

      expect(deterministic, entry.label).toBe(
        `${entry.acknowledgement}\n${entry.followUpQuestion}`,
      );
      expect(viaHelper, `${entry.label} / helper`).toBe(expected);
      expect(baseline, `${entry.label} / baseline`).toBe(expected);
      expect(production, `${entry.label} / production`).toBe(expected);
      expect(baseline.endsWith(entry.followUpQuestion), entry.label).toBe(true);
      expect(
        baseline.slice(baseline.length - entry.followUpQuestion.length),
        `${entry.label} / follow-up identity`,
      ).toBe(entry.followUpQuestion);
      expect(baseline.includes(entry.followUpQuestion), entry.label).toBe(true);
      expect(baseline, `${entry.label} / diverges from deterministic`).not.toBe(
        deterministic,
      );
      expect(selectConversationalObjective(replyPlan)).toEqual({
        id: entry.expectedObjectiveId,
        catalogueWording: entry.followUpQuestion,
      });
      expect(replyPlan, `${entry.label} / unchanged`).toEqual(before);

      const first = generateBaselineConversationalReply(replyPlan);
      const second = generateBaselineConversationalReply(replyPlan);
      expect(second, `${entry.label} / repeat`).toBe(first);
    }
  });

  it('preserves Phase 15B acknowledgement-only and all unaffected plan shapes', () => {
    const acknowledgementOnly = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(acknowledgementOnly)).toBe(
      'Great, Cairns it is.',
    );
    expect(renderConversationReplyPlan(acknowledgementOnly)).toBe(
      ACKS.destination('Cairns'),
    );

    const unchangedCases: Array<{
      label: string;
      replyPlan: ConversationReplyPlan;
      expected: string;
    }> = [
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
          followUpQuestion: FOLLOW_UPS.departureDate,
          messageInterpreted: true,
        }),
        expected: `${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}\n${FOLLOW_UPS.departureDate}`,
      },
      {
        label: 'empty plan',
        replyPlan: plan(),
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
  });

  it('preserves immutability and Phase 14I deterministic fallback', () => {
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(replyPlan);
    const deterministic = renderConversationReplyPlan(replyPlan);
    const expected = expectedTransition(
      ACKS.origin('Sydney'),
      FOLLOW_UPS.departureDate,
    );

    expect(deterministic).toBe(
      `${ACKS.origin('Sydney')}\n${FOLLOW_UPS.departureDate}`,
    );
    expect(generateBaselineConversationalReply(replyPlan)).toBe(expected);
    expect(replyPlan).toEqual(before);

    const input = buildConversationalLayerInput(replyPlan);
    const inputBefore = structuredClone(input);
    expect(generateBaselineConversationalReply(replyPlan)).toBe(expected);
    expect(input).toEqual(inputBefore);
    expect(Object.isFrozen(input)).toBe(true);

    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      expect(receivedPlan).toBe(replyPlan);
      throw new Error('forced-baseline-failure:15c');
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
