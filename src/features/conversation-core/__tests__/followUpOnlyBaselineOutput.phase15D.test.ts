import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15D — follow-up-only baseline output characterisation.
 *
 * Investigation-only. Proves plans with empty acknowledgements and a non-null
 * follow-up currently remain byte-identical to deterministic rendering.
 * Does not transform follow-up wording.
 */

const ROOT = process.cwd();
const RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
);
const MODE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const BASELINE_MODE_CONST =
  /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/;

/** Catalogue follow-ups that characterise the Phase 15D follow-up-only surface. */
const FOLLOW_UP_ONLY_CATALOGUE = [
  { id: 'destination', wording: FOLLOW_UPS.destination },
  { id: 'origin', wording: FOLLOW_UPS.origin },
  { id: 'departureDate', wording: FOLLOW_UPS.departureDate },
  { id: 'returnDate', wording: FOLLOW_UPS.returnDate },
  { id: 'flightsAdultCount', wording: FOLLOW_UPS.flightsAdultCount },
  {
    id: 'accommodationGuestCount',
    wording: FOLLOW_UPS.accommodationGuestCount,
  },
  { id: 'activities', wording: FOLLOW_UPS.activities },
  { id: 'restaurants', wording: FOLLOW_UPS.restaurants },
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

function freezePlan(replyPlan: ConversationReplyPlan): ConversationReplyPlan {
  return Object.freeze({
    ...replyPlan,
    acknowledgements: Object.freeze([...replyPlan.acknowledgements]),
  });
}

describe('phase 15D — follow-up-only baseline output characterisation', () => {
  it('traces the activated runtime path and eligibility branch order', () => {
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const modeDriven = readFileSync(MODE_SOURCE, 'utf8');
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');

    expect(seam).toMatch(BASELINE_MODE_CONST);
    expect(modeDriven).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);/,
    );
    expect(renderer).toMatch(/transformBaselineAcknowledgement/);
    expect(renderer).toMatch(/renderBaselineAcknowledgementFollowUp/);
    expect(renderer).toMatch(
      /wording:\s*renderConversationReplyPlan\(plan\)/,
    );

    // Follow-up-only (empty acknowledgements) falls through to deterministic.
    expect(renderer.indexOf('acknowledgements.length === 1')).toBeGreaterThan(
      -1,
    );
    expect(renderer.includes('acknowledgements.length === 0')).toBe(false);
  });

  it('characterises every eligible follow-up-only catalogue plan as byte-identical', () => {
    expect(FOLLOW_UP_ONLY_CATALOGUE).toHaveLength(8);

    for (const entry of FOLLOW_UP_ONLY_CATALOGUE) {
      const replyPlan = freezePlan(
        plan({
          acknowledgements: [],
          followUpQuestion: entry.wording,
          messageInterpreted: true,
        }),
      );
      const before = structuredClone(replyPlan);
      const deterministic = renderConversationReplyPlan(replyPlan);
      const baseline = generateBaselineConversationalReply(replyPlan);
      const production = renderIntegratedConversationReplyPlan({
        plan: replyPlan,
      });
      const layer = renderBaselineConversationalLayer(
        buildConversationalLayerInput(replyPlan),
      );
      const objective = selectConversationalObjective(replyPlan);

      expect(replyPlan.acknowledgements.length, entry.id).toBe(0);
      expect(replyPlan.followUpQuestion, entry.id).toBe(entry.wording);
      expect(deterministic, entry.id).toBe(entry.wording);
      expect(baseline, `${entry.id} / baseline`).toBe(entry.wording);
      expect(production, `${entry.id} / production`).toBe(entry.wording);
      expect(layer.wording, `${entry.id} / layer`).toBe(entry.wording);
      expect(baseline, `${entry.id} / byte-identical`).toBe(deterministic);
      expect(production, `${entry.id} / production identical`).toBe(
        deterministic,
      );

      // No acknowledgement or filler introduced.
      expect(baseline.includes('Great,'), entry.id).toBe(false);
      expect(baseline.includes('Perfect,'), entry.id).toBe(false);
      expect(baseline.includes('No problem'), entry.id).toBe(false);
      expect(baseline.includes('Now,'), entry.id).toBe(false);
      expect(baseline.includes('Next,'), entry.id).toBe(false);
      expect(baseline.includes('Also,'), entry.id).toBe(false);
      expect(baseline.includes('\n'), entry.id).toBe(false);

      expect(objective, entry.id).toEqual({
        id: entry.id,
        catalogueWording: entry.wording,
      });
      expect(replyPlan, `${entry.id} / unchanged`).toEqual(before);
      expect(
        generateBaselineConversationalReply(replyPlan),
        `${entry.id} / repeat`,
      ).toBe(baseline);
    }
  });

  it('keeps neutral continuation outside the follow-up-only characterisation group', () => {
    const ids: readonly string[] = FOLLOW_UP_ONLY_CATALOGUE.map(
      (entry) => entry.id,
    );
    expect(ids).not.toContain('neutralContinuation');
    expect(
      FOLLOW_UP_ONLY_CATALOGUE.some(
        (entry) =>
          (entry.wording as string) === FOLLOW_UPS.neutralContinuation,
      ),
    ).toBe(false);

    const neutralPlan = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
    );
    const deterministic = renderConversationReplyPlan(neutralPlan);
    const baseline = generateBaselineConversationalReply(neutralPlan);

    expect(deterministic).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(baseline).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(baseline).toBe(deterministic);
    expect(selectConversationalObjective(neutralPlan)?.id).toBe(
      'neutralContinuation',
    );
  });

  it('preserves Phase 15B / 15C ownership and unaffected plan shapes', () => {
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
    expect(renderConversationReplyPlan(acknowledgementOnly)).toBe(
      ACKS.destination('Cairns'),
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
    expect(
      generateBaselineConversationalReply(acknowledgementPlusFollowUp).endsWith(
        FOLLOW_UPS.origin,
      ),
    ).toBe(true);

    const multipleAcknowledgements = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const multiDeterministic = renderConversationReplyPlan(
      multipleAcknowledgements,
    );
    expect(generateBaselineConversationalReply(multipleAcknowledgements)).toBe(
      multiDeterministic,
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
