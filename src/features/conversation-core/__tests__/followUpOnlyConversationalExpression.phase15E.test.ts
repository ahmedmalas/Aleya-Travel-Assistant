import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15E — follow-up-only conversational expression.
 *
 * Proves eligible follow-up-only plans gain a short lead-in while preserving
 * the deterministic follow-up question byte-for-byte.
 */

const ROOT = process.cwd();
const RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);
const FOLLOW_UP_ONLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineFollowUpOnly.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const BASELINE_MODE_CONST =
  /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/;

const TRANSFORMED_FOLLOW_UPS: Array<{
  id: string;
  followUp: string;
  expected: string;
}> = [
  {
    id: 'destination',
    followUp: FOLLOW_UPS.destination,
    expected: `Let's start with the destination. ${FOLLOW_UPS.destination}`,
  },
  {
    id: 'origin',
    followUp: FOLLOW_UPS.origin,
    expected: `Let's begin with where you're travelling from. ${FOLLOW_UPS.origin}`,
  },
  {
    id: 'departureDate',
    followUp: FOLLOW_UPS.departureDate,
    expected: `Now for the timing. ${FOLLOW_UPS.departureDate}`,
  },
  {
    id: 'returnDate',
    followUp: FOLLOW_UPS.returnDate,
    expected: `And for your return. ${FOLLOW_UPS.returnDate}`,
  },
  {
    id: 'flightsAdultCount',
    followUp: FOLLOW_UPS.flightsAdultCount,
    expected: `Now for the flights. ${FOLLOW_UPS.flightsAdultCount}`,
  },
  {
    id: 'accommodationGuestCount',
    followUp: FOLLOW_UPS.accommodationGuestCount,
    expected: `Now for the accommodation. ${FOLLOW_UPS.accommodationGuestCount}`,
  },
  {
    id: 'activities',
    followUp: FOLLOW_UPS.activities,
    expected: `Let's look at activities. ${FOLLOW_UPS.activities}`,
  },
  {
    id: 'restaurants',
    followUp: FOLLOW_UPS.restaurants,
    expected: `Now for dining. ${FOLLOW_UPS.restaurants}`,
  },
];

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

describe('phase 15E — follow-up-only conversational expression', () => {
  it('keeps production mode and explicit branch ownership order', () => {
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');
    const followUpOnly = readFileSync(FOLLOW_UP_ONLY_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');

    expect(seam).toMatch(BASELINE_MODE_CONST);
    expect(renderer).toMatch(/transformBaselineAcknowledgement/);
    expect(renderer).toMatch(/renderBaselineAcknowledgementFollowUp/);
    expect(renderer).toMatch(/renderBaselineFollowUpOnly/);
    // Explicit ownership order in the executable branch body.
    const branch15B = renderer.indexOf(
      'transformBaselineAcknowledgement(plan.acknowledgements[0]!)',
    );
    const branch15C = renderer.indexOf('renderBaselineAcknowledgementFollowUp({');
    const branch15E = renderer.indexOf('renderBaselineFollowUpOnly({');
    const fallthrough = renderer.lastIndexOf(
      'renderConversationReplyPlan(plan)',
    );
    expect(branch15B).toBeGreaterThan(-1);
    expect(branch15C).toBeGreaterThan(branch15B);
    expect(branch15E).toBeGreaterThan(branch15C);
    expect(fallthrough).toBeGreaterThan(branch15E);
    expect(renderer).toMatch(
      /plan\.acknowledgements\.length === 0 &&\s*plan\.followUpQuestion !== null/,
    );
    expect(followUpOnly.includes("from './conversationReplyCatalogue'")).toBe(
      false,
    );
    expect(followUpOnly.includes('neutralContinuation')).toBe(false);
    expect(index.includes('renderBaselineFollowUpOnly')).toBe(false);
  });

  it('transforms all eight supported follow-up-only categories with byte-identical questions', () => {
    expect(TRANSFORMED_FOLLOW_UPS).toHaveLength(8);

    for (const entry of TRANSFORMED_FOLLOW_UPS) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [],
          followUpQuestion: entry.followUp,
          messageInterpreted: true,
        }),
      );
      const before = structuredClone(replyPlan);
      const deterministic = renderConversationReplyPlan(replyPlan);
      const viaHelper = renderBaselineFollowUpOnly({
        followUpQuestion: entry.followUp,
      });
      const baseline = generateBaselineConversationalReply(replyPlan);
      const production = renderIntegratedConversationReplyPlan({
        plan: replyPlan,
      });
      const layer = renderBaselineConversationalLayer(
        buildConversationalLayerInput(replyPlan),
      );

      expect(deterministic, entry.id).toBe(entry.followUp);
      expect(viaHelper, `${entry.id} / helper`).toBe(entry.expected);
      expect(baseline, `${entry.id} / baseline`).toBe(entry.expected);
      expect(production, `${entry.id} / production`).toBe(entry.expected);
      expect(layer.wording, `${entry.id} / layer`).toBe(entry.expected);
      expect(production, `${entry.id} / path agree`).toBe(baseline);

      expect(baseline.endsWith(entry.followUp), entry.id).toBe(true);
      expect(
        baseline.slice(baseline.length - entry.followUp.length),
        `${entry.id} / follow-up identity`,
      ).toBe(entry.followUp);
      expect(baseline.includes(entry.followUp), entry.id).toBe(true);

      expect(baseline.includes('Great,'), entry.id).toBe(false);
      expect(baseline.includes('Perfect,'), entry.id).toBe(false);
      expect(baseline.includes('No problem'), entry.id).toBe(false);
      expect(baseline.includes('\n'), entry.id).toBe(false);

      expect(selectConversationalObjective(replyPlan)?.id).toBe(entry.id);
      expect(replyPlan, `${entry.id} / unchanged`).toEqual(before);
      expect(
        generateBaselineConversationalReply(replyPlan),
        `${entry.id} / repeat`,
      ).toBe(baseline);
    }
  });

  it('keeps unknown follow-ups, neutral continuation, and other ownership boundaries safe', () => {
    const unknown = 'Would you like a window seat preference noted?';
    const unknownPlan = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: unknown,
        messageInterpreted: true,
      }),
    );
    expect(renderBaselineFollowUpOnly({ followUpQuestion: unknown })).toBe(
      unknown,
    );
    expect(generateBaselineConversationalReply(unknownPlan)).toBe(unknown);
    expect(renderIntegratedConversationReplyPlan({ plan: unknownPlan })).toBe(
      unknown,
    );
    expect(renderConversationReplyPlan(unknownPlan)).toBe(unknown);

    const neutralPlan = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(neutralPlan)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
    expect(renderConversationReplyPlan(neutralPlan)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
    expect(selectConversationalObjective(neutralPlan)?.id).toBe(
      'neutralContinuation',
    );

    const acknowledgementOnly = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(acknowledgementOnly)).toBe(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')),
    );

    const acknowledgementPlusFollowUp = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns')],
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    expect(
      generateBaselineConversationalReply(acknowledgementPlusFollowUp),
    ).toBe(expectedActivatedBaselineReply(acknowledgementPlusFollowUp));
    expect(
      generateBaselineConversationalReply(acknowledgementPlusFollowUp),
    ).not.toBe(renderConversationReplyPlan(acknowledgementPlusFollowUp));

    const multipleAcknowledgements = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(multipleAcknowledgements)).toBe(
      renderConversationReplyPlan(multipleAcknowledgements),
    );

    const emptyPlan = freezePlan(plan());
    expect(generateBaselineConversationalReply(emptyPlan)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
    expect(renderConversationReplyPlan(emptyPlan)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
  });
});
