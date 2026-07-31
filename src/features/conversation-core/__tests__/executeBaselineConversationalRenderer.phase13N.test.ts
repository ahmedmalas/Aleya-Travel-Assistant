import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationalLayerInput } from '../conversationalLayerContracts';
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
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 13N — baseline conversational renderer execution characterisation.
 *
 * Proves composition of the baseline registry factory and execution boundary
 * without runtime wiring or duplicate rendering logic.
 */

const ROOT = process.cwd();
const EXECUTE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/executeBaselineConversationalRenderer.ts',
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
  style?: Parameters<typeof buildConversationalLayerInput>[1],
) {
  const input = buildConversationalLayerInput(replyPlan, style);
  const output = executeBaselineConversationalRenderer(input);
  const expected = expectedActivatedBaselineReply(replyPlan);
  expect(output).toEqual({ wording: expected });
  expect(output).toEqual(renderBaselineConversationalLayer(input));
  return { input, output, expected };
}

describe('phase 13N — executeBaselineConversationalRenderer', () => {
  it('composes registry factory + execution boundary without duplicate logic or runtime wiring', () => {
    const source = readFileSync(EXECUTE_SOURCE, 'utf8');

    expect(source.includes('createBaselineConversationalRendererRegistry')).toBe(
      true,
    );
    expect(source.includes('executeConversationalLayerRenderer')).toBe(true);
    expect(source.includes("'baseline'")).toBe(true);
    expect(source.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(source.includes('renderConversationReplyPlan')).toBe(false);
    expect(source.includes('selectConversationalObjective')).toBe(false);
    expect(source.includes('selectConversationalLayerRenderer')).toBe(false);
    expect(source.includes('invokeConversationalLayerRenderer')).toBe(false);
    expect(source.includes('followUpQuestion')).toBe(false);
    expect(source.includes('catalogueWording')).toBe(false);
    expect(source.includes('styleProfile')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('fallback')).toBe(false);
    expect(source.includes('OpenAI')).toBe(false);
    expect(source.includes('LLM')).toBe(false);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'executeBaselineConversationalRenderer',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'executeBaselineConversationalRenderer',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'executeBaselineConversationalRenderer',
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
    ).toBe(`For activities, ${FOLLOW_UPS.activities}`);

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

  it('supports null objective and reference style profiles without behavioural effect', () => {
    const replyPlan = plan({
      acknowledgements: ['Perfect.'],
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    });
    const expected = expectedActivatedBaselineReply(replyPlan);

    const nullObjective = createConversationalLayerInput(replyPlan, null);
    expect(nullObjective.objective).toBeNull();
    expect(executeBaselineConversationalRenderer(nullObjective)).toEqual({
      wording: expected,
    });

    for (const style of [
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
      REFERENCE_CONVERSATIONAL_STYLE_WARM,
      REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
    ]) {
      expectBaseline(replyPlan, style);
    }
  });

  it('leaves frozen input unmodified and repeats equivalent output', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze(['Great — Brisbane.']),
        followUpQuestion: FOLLOW_UPS.destination,
        messageInterpreted: true,
      }),
    );
    const input = Object.freeze(
      buildConversationalLayerInput(
        replyPlan,
        REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
      ),
    );
    const before = structuredClone(input);
    const expected = expectedActivatedBaselineReply(replyPlan);

    const first = executeBaselineConversationalRenderer(input);
    const second = executeBaselineConversationalRenderer(input);
    const third = executeBaselineConversationalRenderer(structuredClone(input));

    expect(first).toEqual({ wording: expected });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(input).toEqual(before);
    expect(Object.isFrozen(input)).toBe(true);
  });
});
