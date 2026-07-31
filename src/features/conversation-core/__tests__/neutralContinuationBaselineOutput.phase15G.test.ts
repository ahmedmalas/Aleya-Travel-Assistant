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
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15G — neutral-continuation baseline output characterisation.
 *
 * Investigation-only. Proves the exact plan shape, selection boundary, and
 * byte-identical activated output for neutral continuation before any
 * conversational transformation of that category.
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

const CANONICAL_NEUTRAL = 'What else should I know about your trip?';

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

    // Neutral is selected as a follow-up string when no specific question applies.
    expect(followUpSource).toMatch(/return NEUTRAL_TRIP_FALLBACK_REPLY/);
    // Continuation prompt is only used when followUpQuestion is null.
    expect(continuationSource).toMatch(
      /if \(input\.followUpQuestion !== null\) \{\s*return null;/,
    );
    expect(continuationSource).toMatch(/return NEUTRAL_TRIP_FALLBACK_REPLY/);
    // Assembled plans store either follow-up or continuation into followUpQuestion.
    expect(assemblySource).toMatch(
      /followUpQuestion: input\.followUpQuestion \?\? input\.continuationPrompt/,
    );
    // Renderer has no dedicated neutral branch; 15E pass-through handles the string.
    expect(renderer.includes('neutralContinuation')).toBe(false);
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

  it('proves exact output is byte-identical across deterministic, baseline, and production', () => {
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
      const viaFollowUpOnly = renderBaselineFollowUpOnly({
        followUpQuestion: CANONICAL_NEUTRAL,
      });

      expect(deterministic, label).toBe(CANONICAL_NEUTRAL);
      expect(baseline, `${label} / baseline`).toBe(CANONICAL_NEUTRAL);
      expect(production, `${label} / production`).toBe(CANONICAL_NEUTRAL);
      expect(layer.wording, `${label} / layer`).toBe(CANONICAL_NEUTRAL);
      expect(viaFollowUpOnly, `${label} / 15E pass-through`).toBe(
        CANONICAL_NEUTRAL,
      );
      expect(baseline, `${label} / byte-identical`).toBe(deterministic);
      expect(production, `${label} / path agree`).toBe(baseline);

      expect(baseline.includes('Great,'), label).toBe(false);
      expect(baseline.includes('Perfect,'), label).toBe(false);
      expect(baseline.includes("Let's start"), label).toBe(false);
      expect(baseline.includes("Let's begin"), label).toBe(false);
      expect(baseline.includes('Now for'), label).toBe(false);
      expect(baseline.includes('And for'), label).toBe(false);
      expect(baseline.includes('Now,'), label).toBe(false);
      expect(baseline.includes('Next,'), label).toBe(false);
      expect(baseline.includes('Also,'), label).toBe(false);
      expect(baseline.includes('\n'), label).toBe(false);
      expect(replyPlan, `${label} / unchanged`).toEqual(before);
    }

    // Empty plan also renders the same string, but via null-coalesce, not a
    // stored neutral followUpQuestion.
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

    // When follow-up selection is suppressed (null), continuation supplies neutral.
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
      CANONICAL_NEUTRAL,
    );
    expect(renderConversationReplyPlan(uninterpreted)).toBe(CANONICAL_NEUTRAL);
  });
});
