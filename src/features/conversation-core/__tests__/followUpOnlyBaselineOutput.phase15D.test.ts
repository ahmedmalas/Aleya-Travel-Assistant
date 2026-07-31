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
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15D — follow-up-only baseline output characterisation.
 *
 * Records the follow-up-only catalogue and ownership boundaries discovered
 * before Phase 15E. After Phase 15E, supported follow-up-only plans receive a
 * lead-in while preserving the question byte-for-byte; this file continues to
 * prove catalogue coverage and cross-phase ownership.
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
  it('traces the activated runtime path and follow-up-only branch ownership', () => {
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const modeDriven = readFileSync(MODE_SOURCE, 'utf8');
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');

    expect(seam).toMatch(BASELINE_MODE_CONST);
    expect(modeDriven).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);/,
    );
    expect(renderer).toMatch(/transformBaselineAcknowledgement/);
    expect(renderer).toMatch(/renderBaselineAcknowledgementFollowUp/);
    expect(renderer).toMatch(/renderBaselineFollowUpOnly/);
    expect(renderer).toMatch(/acknowledgements\.length === 0/);
    expect(renderer).toMatch(
      /wording:\s*renderConversationReplyPlan\(plan\)/,
    );
  });

  it('characterises every eligible follow-up-only catalogue plan and preserves the question', () => {
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
      const expected = expectedActivatedBaselineReply(replyPlan);

      expect(replyPlan.acknowledgements.length, entry.id).toBe(0);
      expect(replyPlan.followUpQuestion, entry.id).toBe(entry.wording);
      expect(deterministic, entry.id).toBe(entry.wording);
      expect(baseline, `${entry.id} / baseline`).toBe(expected);
      expect(production, `${entry.id} / production`).toBe(expected);
      expect(layer.wording, `${entry.id} / layer`).toBe(expected);
      expect(baseline.endsWith(entry.wording), entry.id).toBe(true);
      expect(
        baseline.slice(baseline.length - entry.wording.length),
        `${entry.id} / question identity`,
      ).toBe(entry.wording);

      // No acknowledgement introduced.
      expect(baseline.includes('Great,'), entry.id).toBe(false);
      expect(baseline.includes('Perfect,'), entry.id).toBe(false);
      expect(baseline.includes('No problem'), entry.id).toBe(false);

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
    expect(baseline).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
    expect(baseline.endsWith(NEUTRAL_TRIP_FALLBACK_REPLY)).toBe(true);
    expect(baseline).not.toBe(deterministic);
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
