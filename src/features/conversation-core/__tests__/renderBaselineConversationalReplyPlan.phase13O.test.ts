import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { executeBaselineConversationalRenderer } from '../executeBaselineConversationalRenderer';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';
import { renderBaselineConversationalReplyPlan } from '../renderBaselineConversationalReplyPlan';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 13O — baseline conversational reply-plan adapter characterisation.
 *
 * Proves ConversationReplyPlan → buildConversationalLayerInput →
 * executeBaselineConversationalRenderer composition without runtime wiring.
 */

const ROOT = process.cwd();
const ADAPTER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalReplyPlan.ts',
);
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

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

function expectBaseline(
  replyPlan: ConversationReplyPlan,
  style?: Parameters<typeof renderBaselineConversationalReplyPlan>[1],
) {
  const output = renderBaselineConversationalReplyPlan(replyPlan, style);
  const input = buildConversationalLayerInput(replyPlan, style);
  const viaExecution = executeBaselineConversationalRenderer(input);
  const expected = expectedActivatedBaselineReply(replyPlan);

  expect(output).toEqual({ wording: expected });
  expect(output).toEqual(viaExecution);
  return { output, input, expected };
}

describe('phase 13O — renderBaselineConversationalReplyPlan', () => {
  it('composes input builder + baseline execution without inspecting or rendering', () => {
    const source = readFileSync(ADAPTER_SOURCE, 'utf8');

    expect(source.includes('buildConversationalLayerInput')).toBe(true);
    expect(source.includes('executeBaselineConversationalRenderer')).toBe(true);
    expect(source.includes('renderConversationReplyPlan')).toBe(false);
    expect(source.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(source.includes('createBaselineConversationalRendererRegistry')).toBe(
      false,
    );
    expect(source.includes('executeConversationalLayerRenderer')).toBe(false);
    expect(source.includes('selectConversationalObjective')).toBe(false);
    expect(source.includes('followUpQuestion')).toBe(false);
    expect(source.includes('acknowledgements')).toBe(false);
    expect(source.includes('catalogueWording')).toBe(false);
    expect(source.includes('tone')).toBe(false);
    expect(source.includes('phrasingPreferences')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('fallback')).toBe(false);
    expect(source.includes('OpenAI')).toBe(false);
    expect(source.includes('LLM')).toBe(false);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'renderBaselineConversationalReplyPlan',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'renderBaselineConversationalReplyPlan',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'renderBaselineConversationalReplyPlan',
      ),
    ).toBe(false);
  });

  it('renders acknowledgement + follow-up with exact deterministic wording', () => {
    const { expected } = expectBaseline(
      plan({
        acknowledgements: ['Great — Brisbane.'],
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    expect(expected).toBe(`Great, Brisbane it is. ${FOLLOW_UPS.origin}`);
  });

  it('renders specific follow-up only, neutral continuation, acknowledgement-only, and empty plans', () => {
    expect(
      expectBaseline(
        plan({
          followUpQuestion: FOLLOW_UPS.activities,
          messageInterpreted: true,
        }),
      ).expected,
    ).toBe(FOLLOW_UPS.activities);

    expect(
      expectBaseline(
        plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      ).expected,
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      expectBaseline(
        plan({
          acknowledgements: ['Perfect.'],
          followUpQuestion: null,
          messageInterpreted: true,
        }),
      ).expected,
    ).toBe('Perfect, got it.');

    expect(expectBaseline(plan()).expected).toBe(
      NEUTRAL_TRIP_FALLBACK_REPLY,
    );
  });

  it('supports a null derived objective and optional style profiles without behavioural effect', () => {
    const emptyPlan = plan({
      acknowledgements: ['Perfect.'],
      followUpQuestion: null,
      messageInterpreted: true,
    });
    expect(selectConversationalObjective(emptyPlan)).toBeNull();
    expect(buildConversationalLayerInput(emptyPlan).objective).toBeNull();
    expect(renderBaselineConversationalReplyPlan(emptyPlan)).toEqual({
      wording: 'Perfect, got it.',
    });

    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    });
    expect(
      renderBaselineConversationalReplyPlan(replyPlan).wording,
    ).toBe(expectedActivatedBaselineReply(replyPlan));

    for (const style of [
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
      REFERENCE_CONVERSATIONAL_STYLE_WARM,
      REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
    ]) {
      expectBaseline(replyPlan, style);
    }
  });

  it('leaves frozen plan and style profile unmodified and repeats equivalent output', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze(['Great — Brisbane.']),
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    const style = REFERENCE_CONVERSATIONAL_STYLE_WARM;
    const planBefore = structuredClone(replyPlan);
    const styleBefore = structuredClone(style);
    const expected = expectedActivatedBaselineReply(replyPlan);

    const first = renderBaselineConversationalReplyPlan(replyPlan, style);
    const second = renderBaselineConversationalReplyPlan(replyPlan, style);
    const third = renderBaselineConversationalReplyPlan(
      structuredClone(replyPlan),
      style,
    );

    expect(first).toEqual({ wording: expected });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(replyPlan).toEqual(planBefore);
    expect(style).toEqual(styleBefore);
    expect(Object.isFrozen(replyPlan)).toBe(true);
    expect(Object.isFrozen(style)).toBe(true);
  });
});
