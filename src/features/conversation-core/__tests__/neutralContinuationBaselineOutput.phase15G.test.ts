import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import {
  CONVERSATION_REPLY_CATALOGUE,
  NEUTRAL_TRIP_FALLBACK_REPLY,
} from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  renderBaselineNeutralContinuation,
} from '../renderBaselineNeutralContinuation';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15G — neutral-continuation baseline output characterisation.
 *
 * Originally investigation-only (pass-through). Phase 15J now owns the
 * activated expression for zero-ack canonical neutral plans; this file retains
 * plan-shape / selection characterisation and updated activated expectations.
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
const CONTINUATION_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationContinuationPrompt.ts',
);
const FOLLOW_UP_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
);
const ASSEMBLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/assembleConversationReplyPlan.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const CANONICAL_NEUTRAL = CANONICAL_NEUTRAL_CONTINUATION_PROMPT;

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

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-15g',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Brisbane',
    origin: 'Sydney',
    departureDate: '2026-08-01',
    returnDate: '2026-08-10',
    ...overrides,
  });
}

describe('phase 15G — neutral-continuation baseline output characterisation', () => {
  it('traces representation, runtime path, and exact plan shape', () => {
    expect(NEUTRAL_TRIP_FALLBACK_REPLY).toBe(CANONICAL_NEUTRAL);
    expect(FOLLOW_UPS.neutralContinuation).toBe(CANONICAL_NEUTRAL);

    const followUpSource = readFileSync(FOLLOW_UP_SOURCE, 'utf8');
    const continuationSource = readFileSync(CONTINUATION_SOURCE, 'utf8');
    const assemblySource = readFileSync(ASSEMBLY_SOURCE, 'utf8');
    const renderer = readFileSync(RENDERER_SOURCE, 'utf8');
    const followUpOnly = readFileSync(FOLLOW_UP_ONLY_SOURCE, 'utf8');

    expect(followUpSource).toMatch(/return NEUTRAL_TRIP_FALLBACK_REPLY/);
    expect(continuationSource).toMatch(
      /if \(input\.followUpQuestion !== null\) \{\s*return null;/,
    );
    expect(continuationSource).toMatch(/return NEUTRAL_TRIP_FALLBACK_REPLY/);
    expect(assemblySource).toMatch(
      /followUpQuestion: input\.followUpQuestion \?\? input\.continuationPrompt/,
    );
    // Phase 15J owns a dedicated neutral branch before follow-up-only.
    expect(renderer).toMatch(/renderBaselineNeutralContinuation/);
    expect(followUpOnly.includes('neutralContinuation')).toBe(false);
    expect(followUpOnly.includes(CANONICAL_NEUTRAL)).toBe(false);

    const neutralPlan = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: CANONICAL_NEUTRAL,
        messageInterpreted: true,
      }),
    );
    expect(neutralPlan).toEqual({
      acknowledgements: [],
      followUpQuestion: CANONICAL_NEUTRAL,
      messageInterpreted: true,
    });
    expect(selectConversationalObjective(neutralPlan)).toEqual({
      id: 'neutralContinuation',
      catalogueWording: CANONICAL_NEUTRAL,
    });
  });

  it('proves activated output for stored neutral plans and deterministic empty coalesce', () => {
    const interpretedNeutral = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: CANONICAL_NEUTRAL,
        messageInterpreted: true,
      }),
    );
    const uninterpretedNeutral = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: CANONICAL_NEUTRAL,
        messageInterpreted: false,
      }),
    );

    for (const [label, replyPlan] of [
      ['interpreted', interpretedNeutral],
      ['uninterpreted', uninterpretedNeutral],
    ] as const) {
      const before = structuredClone(replyPlan);
      const deterministic = renderConversationReplyPlan(replyPlan);
      const baseline = generateBaselineConversationalReply(replyPlan);
      const production = renderIntegratedConversationReplyPlan({
        plan: replyPlan,
      });
      const layer = renderBaselineConversationalLayer(
        buildConversationalLayerInput(replyPlan),
      );
      const viaHelper = renderBaselineNeutralContinuation({
        followUpQuestion: CANONICAL_NEUTRAL,
      });
      // Follow-up-only helper still pass-throughs; 15J owns the transform.
      const viaFollowUpOnly = renderBaselineFollowUpOnly({
        followUpQuestion: CANONICAL_NEUTRAL,
      });

      expect(deterministic, label).toBe(CANONICAL_NEUTRAL);
      expect(baseline, `${label} / baseline`).toBe(
        ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
      );
      expect(production, `${label} / production`).toBe(
        ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
      );
      expect(layer.wording, `${label} / layer`).toBe(
        ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
      );
      expect(viaHelper, `${label} / 15J helper`).toBe(
        ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
      );
      expect(viaFollowUpOnly, `${label} / 15E helper`).toBe(CANONICAL_NEUTRAL);
      expect(production, `${label} / path agree`).toBe(baseline);
      expect(baseline.endsWith(CANONICAL_NEUTRAL), label).toBe(true);
      expect(replyPlan, `${label} / unchanged`).toEqual(before);
    }

    // Empty plan still null-coalesces deterministically (not Phase 15J eligible).
    const emptyPlan = freezePlan(plan());
    expect(emptyPlan.followUpQuestion).toBeNull();
    expect(renderConversationReplyPlan(emptyPlan)).toBe(CANONICAL_NEUTRAL);
    expect(generateBaselineConversationalReply(emptyPlan)).toBe(
      CANONICAL_NEUTRAL,
    );
    expect(emptyPlan.followUpQuestion).not.toBe(CANONICAL_NEUTRAL);
  });

  it('characterises the selection boundary that excludes neutral when a specific follow-up is required', () => {
    const missingDestination = createState();
    expect(selectConversationFollowUpQuestion(missingDestination)).toBe(
      FOLLOW_UPS.destination,
    );
    expect(
      selectConversationContinuationPrompt({
        followUpQuestion: FOLLOW_UPS.destination,
      }),
    ).toBeNull();

    const missingOrigin = createState({ destination: 'Brisbane' });
    expect(selectConversationFollowUpQuestion(missingOrigin)).toBe(
      FOLLOW_UPS.origin,
    );

    const flightsNeedAdults = completeCore({ flightsRequested: true });
    expect(selectConversationFollowUpQuestion(flightsNeedAdults)).toBe(
      FOLLOW_UPS.flightsAdultCount,
    );

    const completeNoContext = completeCore();
    expect(selectConversationFollowUpQuestion(completeNoContext)).toBe(
      CANONICAL_NEUTRAL,
    );
    expect(
      selectConversationContinuationPrompt({
        followUpQuestion: CANONICAL_NEUTRAL,
      }),
    ).toBeNull();

    expect(
      selectConversationContinuationPrompt({ followUpQuestion: null }),
    ).toBe(CANONICAL_NEUTRAL);
    const assembledFromContinuation = assembleConversationReplyPlan({
      acknowledgement: null,
      followUpQuestion: null,
      continuationPrompt: CANONICAL_NEUTRAL,
      messageInterpreted: false,
    });
    expect(assembledFromContinuation).toEqual({
      acknowledgements: [],
      followUpQuestion: CANONICAL_NEUTRAL,
      messageInterpreted: false,
    });
  });

  it('preserves Phase 15B / 15C / 15F ownership and unaffected shapes', () => {
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

    const followUpOnly = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: FOLLOW_UPS.destination,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(followUpOnly)).toBe(
      expectedActivatedBaselineReply(followUpOnly),
    );
    expect(generateBaselineConversationalReply(followUpOnly)).toBe(
      `Let's start with the destination. ${FOLLOW_UPS.destination}`,
    );

    const unknown = 'Would you like a window seat preference noted?';
    const unknownPlan = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: unknown,
        messageInterpreted: true,
      }),
    );
    expect(generateBaselineConversationalReply(unknownPlan)).toBe(unknown);
    expect(renderConversationReplyPlan(unknownPlan)).toBe(unknown);

    const emptyPlan = freezePlan(plan());
    expect(generateBaselineConversationalReply(emptyPlan)).toBe(
      CANONICAL_NEUTRAL,
    );

    const uninterpreted = freezePlan(
      plan({
        acknowledgements: [],
        followUpQuestion: CANONICAL_NEUTRAL,
        messageInterpreted: false,
      }),
    );
    expect(generateBaselineConversationalReply(uninterpreted)).toBe(
      ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
    );
    expect(renderConversationReplyPlan(uninterpreted)).toBe(CANONICAL_NEUTRAL);
  });
});
