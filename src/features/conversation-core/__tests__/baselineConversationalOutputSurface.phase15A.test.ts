import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import type { ConversationalStyleProfile } from '../conversationalLayerContracts';
import * as baselineModule from '../generateBaselineConversationalReply';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { renderConversationReplyPlanByIntegrationMode } from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 15A — baseline conversational output surface characterisation.
 *
 * Characterises exact activated baseline wording. Acknowledgement-only plans
 * receive the Phase 15B transform; all other shapes remain identity-passthrough
 * relative to the deterministic renderer.
 */

const ROOT = process.cwd();
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
);
const BASELINE_RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
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

function expectedBaselineWording(replyPlan: ConversationReplyPlan): string {
  if (
    replyPlan.acknowledgements.length === 1 &&
    replyPlan.followUpQuestion === null
  ) {
    return transformBaselineAcknowledgement(replyPlan.acknowledgements[0]!);
  }
  return renderConversationReplyPlan(replyPlan);
}

type CharacterisedCase = {
  label: string;
  replyPlan: ConversationReplyPlan;
  expectedOutput: string;
  expectedObjectiveId: string | null;
  expectedCatalogueWording: string | null;
};

const CHARACTERISED_CASES: CharacterisedCase[] = [
  {
    label: 'acknowledgement only',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Brisbane')],
      followUpQuestion: null,
      messageInterpreted: true,
    }),
    expectedOutput: 'Great, Brisbane it is.',
    expectedObjectiveId: null,
    expectedCatalogueWording: null,
  },
  {
    label: 'follow-up only',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    }),
    expectedOutput: FOLLOW_UPS.origin,
    expectedObjectiveId: 'origin',
    expectedCatalogueWording: FOLLOW_UPS.origin,
  },
  {
    label: 'acknowledgement + follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Brisbane')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    }),
    expectedOutput: `${ACKS.destination('Brisbane')}\n${FOLLOW_UPS.origin}`,
    expectedObjectiveId: 'origin',
    expectedCatalogueWording: FOLLOW_UPS.origin,
  },
  {
    label: 'neutral continuation',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    }),
    expectedOutput: NEUTRAL_TRIP_FALLBACK_REPLY,
    expectedObjectiveId: 'neutralContinuation',
    expectedCatalogueWording: FOLLOW_UPS.neutralContinuation,
  },
  {
    label: 'capability enabled',
    replyPlan: plan({
      acknowledgements: [ACKS.addedCapabilities('flights')],
      followUpQuestion: FOLLOW_UPS.flightsAdultCount,
      messageInterpreted: true,
    }),
    expectedOutput: `${ACKS.addedCapabilities('flights')}\n${FOLLOW_UPS.flightsAdultCount}`,
    expectedObjectiveId: 'flightsAdultCount',
    expectedCatalogueWording: FOLLOW_UPS.flightsAdultCount,
  },
  {
    label: 'capability disabled',
    replyPlan: plan({
      acknowledgements: [ACKS.removedCapabilities('flights')],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: true,
    }),
    expectedOutput: `${ACKS.removedCapabilities('flights')}\n${FOLLOW_UPS.neutralContinuation}`,
    expectedObjectiveId: 'neutralContinuation',
    expectedCatalogueWording: FOLLOW_UPS.neutralContinuation,
  },
  {
    label: 'field removed',
    replyPlan: plan({
      acknowledgements: [ACKS.destinationRemoved],
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    }),
    expectedOutput: `${ACKS.destinationRemoved}\n${FOLLOW_UPS.destination}`,
    expectedObjectiveId: 'destination',
    expectedCatalogueWording: FOLLOW_UPS.destination,
  },
  {
    label: 'generic acknowledgement',
    replyPlan: plan({
      acknowledgements: [ACKS.genericTravelFieldChange],
      followUpQuestion: null,
      messageInterpreted: true,
    }),
    expectedOutput: 'Perfect, got it.',
    expectedObjectiveId: null,
    expectedCatalogueWording: null,
  },
  {
    label: 'uninterpreted message',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
      messageInterpreted: false,
    }),
    expectedOutput: NEUTRAL_TRIP_FALLBACK_REPLY,
    expectedObjectiveId: 'neutralContinuation',
    expectedCatalogueWording: FOLLOW_UPS.neutralContinuation,
  },
  {
    label: 'empty reply plan',
    replyPlan: plan({
      acknowledgements: [],
      followUpQuestion: null,
      messageInterpreted: false,
    }),
    expectedOutput: NEUTRAL_TRIP_FALLBACK_REPLY,
    expectedObjectiveId: null,
    expectedCatalogueWording: null,
  },
  {
    label: 'multi-component reply plan',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    }),
    expectedOutput: `${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}\n${FOLLOW_UPS.departureDate}`,
    expectedObjectiveId: 'departureDate',
    expectedCatalogueWording: FOLLOW_UPS.departureDate,
  },
];

const STYLE_PROFILES: ReadonlyArray<Readonly<ConversationalStyleProfile>> = [
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
];

describe('phase 15A — baseline conversational output surface', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps production mode baseline-conversational and baseline renderer transform wiring', () => {
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const renderer = readFileSync(BASELINE_RENDERER_SOURCE, 'utf8');

    expect(seam).toMatch(BASELINE_MODE_CONST);
    expect(seam).not.toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );

    expect(renderer).toMatch(
      /wording:\s*renderConversationReplyPlan\(plan\)/,
    );
    expect(renderer).toMatch(/transformBaselineAcknowledgement/);
    expect(renderer.includes('styleProfile')).toBe(true);
    expect(renderer).toMatch(/Ignores styleProfile/);
    expect(renderer.includes('empathy')).toBe(false);
    expect(renderer.includes('repair')).toBe(false);
    expect(renderer.includes('prompt')).toBe(false);
    expect(renderer.includes('Math.random')).toBe(false);
    expect(renderer.includes('async ')).toBe(false);
  });

  it('characterises exact activated baseline output for each reply-plan category', () => {
    for (const entry of CHARACTERISED_CASES) {
      const frozen = freezePlan(entry.replyPlan);
      const before = structuredClone(frozen);
      const deterministic = renderConversationReplyPlan(frozen);
      const baseline = generateBaselineConversationalReply(frozen);
      const production = renderIntegratedConversationReplyPlan({
        plan: frozen,
      });
      const layerInput = buildConversationalLayerInput(frozen);
      const objective = selectConversationalObjective(frozen);
      const layerOutput = renderBaselineConversationalLayer(layerInput);

      if (
        frozen.acknowledgements.length === 1 &&
        frozen.followUpQuestion === null
      ) {
        expect(deterministic, entry.label).toBe(frozen.acknowledgements[0]);
      } else {
        expect(deterministic, entry.label).toBe(entry.expectedOutput);
      }
      expect(baseline, `${entry.label} / baseline`).toBe(entry.expectedOutput);
      expect(production, `${entry.label} / production`).toBe(
        entry.expectedOutput,
      );
      expect(layerOutput.wording, `${entry.label} / layer`).toBe(
        entry.expectedOutput,
      );
      expect(baseline, `${entry.label} / helper`).toBe(
        expectedBaselineWording(frozen),
      );

      if (entry.expectedObjectiveId === null) {
        expect(objective, `${entry.label} / objective`).toBeNull();
        expect(layerInput.objective, `${entry.label} / input objective`).toBeNull();
      } else {
        expect(objective, `${entry.label} / objective`).toEqual({
          id: entry.expectedObjectiveId,
          catalogueWording: entry.expectedCatalogueWording,
        });
        expect(layerInput.objective, `${entry.label} / input objective`).toEqual(
          {
            id: entry.expectedObjectiveId,
            catalogueWording: entry.expectedCatalogueWording,
          },
        );
      }

      expect(layerInput.plan, `${entry.label} / plan ref`).toBe(frozen);
      expect(frozen, `${entry.label} / plan unchanged`).toEqual(before);
      expect(Object.isFrozen(layerInput), entry.label).toBe(true);
    }
  });

  it('proves style, empathy, and repair do not alter non-eligible plan wording', () => {
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Hobart')],
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    const expected = `${ACKS.destination('Hobart')}\n${FOLLOW_UPS.origin}`;
    const before = structuredClone(replyPlan);

    expect(generateBaselineConversationalReply(replyPlan)).toBe(expected);
    expect(renderConversationReplyPlan(replyPlan)).toBe(expected);

    for (const style of STYLE_PROFILES) {
      const styleBefore = structuredClone(style);
      expect(
        generateBaselineConversationalReply(replyPlan, style),
        style.id,
      ).toBe(expected);
      const input = buildConversationalLayerInput(replyPlan, style);
      expect(input.styleProfile, style.id).toBe(style);
      expect(
        renderBaselineConversationalLayer(input).wording,
        `${style.id} / layer`,
      ).toBe(expected);
      expect(style, `${style.id} / unchanged`).toEqual(styleBefore);
    }

    // Objective metadata does not alter wording when the plan is fixed.
    // Acknowledgement-only plans receive the approved transform.
    const acknowledgementOnly = freezePlan(
      plan({
        acknowledgements: [ACKS.genericTravelFieldChange],
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    const withFollowUp = freezePlan(
      plan({
        acknowledgements: [ACKS.genericTravelFieldChange],
        followUpQuestion: FOLLOW_UPS.activities,
        messageInterpreted: true,
      }),
    );
    expect(selectConversationalObjective(acknowledgementOnly)).toBeNull();
    expect(selectConversationalObjective(withFollowUp)?.id).toBe('activities');
    expect(generateBaselineConversationalReply(acknowledgementOnly)).toBe(
      'Perfect, got it.',
    );
    expect(generateBaselineConversationalReply(withFollowUp)).toBe(
      `${ACKS.genericTravelFieldChange}\n${FOLLOW_UPS.activities}`,
    );

    // Same acknowledgement text with different follow-up objectives still
    // renders from plan fields only (objective id never overrides plan).
    const destinationObjectivePlan = freezePlan(
      plan({
        acknowledgements: [ACKS.origin('Perth')],
        followUpQuestion: FOLLOW_UPS.destination,
        messageInterpreted: true,
      }),
    );
    const restaurantsObjectivePlan = freezePlan(
      plan({
        acknowledgements: [ACKS.origin('Perth')],
        followUpQuestion: FOLLOW_UPS.restaurants,
        messageInterpreted: true,
      }),
    );
    expect(selectConversationalObjective(destinationObjectivePlan)?.id).toBe(
      'destination',
    );
    expect(selectConversationalObjective(restaurantsObjectivePlan)?.id).toBe(
      'restaurants',
    );
    expect(generateBaselineConversationalReply(destinationObjectivePlan)).toBe(
      `${ACKS.origin('Perth')}\n${FOLLOW_UPS.destination}`,
    );
    expect(generateBaselineConversationalReply(restaurantsObjectivePlan)).toBe(
      `${ACKS.origin('Perth')}\n${FOLLOW_UPS.restaurants}`,
    );

    expect(replyPlan).toEqual(before);
  });

  it('proves deterministic objective selection, input immutability, and repeated-call determinism', () => {
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const planBefore = structuredClone(replyPlan);
    const input = buildConversationalLayerInput(replyPlan);
    const inputBefore = structuredClone(input);

    expect(selectConversationalObjective(replyPlan)).toEqual({
      id: 'departureDate',
      catalogueWording: FOLLOW_UPS.departureDate,
    });
    expect(selectConversationalObjective(replyPlan)).toEqual(
      selectConversationalObjective(replyPlan),
    );

    const first = generateBaselineConversationalReply(replyPlan);
    const second = generateBaselineConversationalReply(replyPlan);
    const third = renderIntegratedConversationReplyPlan({ plan: replyPlan });
    expect(first).toBe(
      `${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}\n${FOLLOW_UPS.departureDate}`,
    );
    expect(second).toBe(first);
    expect(third).toBe(first);

    expect(replyPlan).toEqual(planBefore);
    expect(input).toEqual(inputBefore);
    expect(Object.isFrozen(input)).toBe(true);
    expect(input.plan).toBe(replyPlan);

    // Renderer can observe empty / single / multi-component plan shapes via plan fields.
    const empty = freezePlan(plan());
    const single = freezePlan(
      plan({
        acknowledgements: [ACKS.destination('Brisbane')],
        messageInterpreted: true,
      }),
    );
    const multi = replyPlan;
    expect(empty.acknowledgements.length).toBe(0);
    expect(single.acknowledgements.length).toBe(1);
    expect(multi.acknowledgements.length).toBe(2);
    expect(generateBaselineConversationalReply(empty)).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
    expect(generateBaselineConversationalReply(single)).toBe(
      'Great, Brisbane it is.',
    );
    expect(generateBaselineConversationalReply(multi)).toBe(first);
  });

  it('proves fallback remains available but is not triggered on successful baseline rendering', () => {
    const replyPlan = freezePlan(
      plan({
        acknowledgements: [ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const expected = `${ACKS.origin('Sydney')}\n${FOLLOW_UPS.departureDate}`;
    const baselineSpy = vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    );

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: replyPlan,
        mode: 'baseline-conversational',
      }),
    ).toBe(expected);
    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      expected,
    );
    expect(baselineSpy).toHaveBeenCalled();
    expect(baselineSpy.mock.results.every((result) => result.type === 'return')).toBe(
      true,
    );

    vi.restoreAllMocks();
    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      expect(receivedPlan).toBe(replyPlan);
      throw new Error('forced-baseline-failure:15a');
    });

    expect(
      renderConversationReplyPlanByIntegrationMode({
        plan: replyPlan,
        mode: 'baseline-conversational',
      }),
    ).toBe(expected);
    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      expected,
    );
  });
});
