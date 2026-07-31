import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createConversationalLayerInput,
  type ConversationalLayerInput,
  type ConversationalLayerOutput,
  type ConversationalLayerRenderer,
} from '../conversationalLayerContracts';
import { renderConversationReplyPlan } from '../generateConversationReply';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 13I — conversational renderer contract characterisation.
 *
 * Proves ConversationalLayerRenderer is wording-only over readonly input and
 * that the deterministic baseline satisfies it without behavioural change.
 */

const ROOT = process.cwd();
const CONTRACTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/conversationalLayerContracts.ts',
);
const BASELINE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
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
    acknowledgementEvent: null,
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

describe('phase 13I — conversational renderer contract', () => {
  it('keeps the renderer contract free of runtime reply integration', () => {
    const contracts = readFileSync(CONTRACTS_SOURCE, 'utf8');
    const baseline = readFileSync(BASELINE_SOURCE, 'utf8');

    expect(contracts.includes('ConversationalLayerRenderer')).toBe(true);
    expect(contracts.includes('OpenAI')).toBe(false);
    expect(contracts.includes('Anthropic')).toBe(false);
    expect(contracts.includes('LLM')).toBe(false);
    expect(contracts.includes('fetch(')).toBe(false);
    expect(contracts.includes('prompt')).toBe(false);

    expect(baseline.includes('ConversationalLayerRenderer')).toBe(true);
    expect(
      baseline.includes(
        'export const renderBaselineConversationalLayer: ConversationalLayerRenderer',
      ),
    ).toBe(true);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'ConversationalLayerRenderer',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'ConversationalLayerRenderer',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes('ConversationalLayerRenderer'),
    ).toBe(false);
    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'renderBaselineConversationalLayer',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'renderBaselineConversationalLayer',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'renderBaselineConversationalLayer',
      ),
    ).toBe(false);
  });

  it('types ConversationalLayerRenderer over readonly input to wording-only output', () => {
    expectTypeOf<ConversationalLayerRenderer>().parameter(0).toEqualTypeOf<
      Readonly<ConversationalLayerInput>
    >();
    expectTypeOf<ConversationalLayerRenderer>().returns.toEqualTypeOf<ConversationalLayerOutput>();

    expectTypeOf<ConversationalLayerOutput>().toEqualTypeOf<{
      readonly wording: string;
    }>();
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('stateUpdate');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('priority');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('eligibility');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('approval');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('toolCall');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('toolCalls');
    expectTypeOf<ConversationalLayerOutput>().not.toHaveProperty('booking');
  });

  it('proves the baseline renderer satisfies ConversationalLayerRenderer', () => {
    expectTypeOf(renderBaselineConversationalLayer).toEqualTypeOf<ConversationalLayerRenderer>();
    expectTypeOf(renderBaselineConversationalLayer)
      .parameter(0)
      .toEqualTypeOf<Readonly<ConversationalLayerInput>>();
    expectTypeOf(renderBaselineConversationalLayer).returns.toEqualTypeOf<ConversationalLayerOutput>();

    const asContract: ConversationalLayerRenderer =
      renderBaselineConversationalLayer;
    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const output = asContract(buildConversationalLayerInput(replyPlan));
    expect(output).toEqual({
      wording: expectedActivatedBaselineReply(replyPlan),
    });
    expect(Object.keys(output)).toEqual(['wording']);
  });

  it('supports nullable objective and optional styleProfile without behavioural effect', () => {
    const replyPlan = plan({
      acknowledgements: ['Perfect.'],
      acknowledgementEvent: null,
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    });
    const expected = expectedActivatedBaselineReply(replyPlan);

    const withNullObjective = renderBaselineConversationalLayer(
      createConversationalLayerInput(replyPlan, null),
    );
    expect(withNullObjective).toEqual({ wording: expected });

    for (const style of [
      undefined,
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
      REFERENCE_CONVERSATIONAL_STYLE_WARM,
      REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
    ]) {
      const input =
        style === undefined
          ? buildConversationalLayerInput(replyPlan)
          : buildConversationalLayerInput(replyPlan, style);
      if (style === undefined) {
        expect(input.styleProfile).toBeUndefined();
      } else {
        expect(input.styleProfile).toBe(style);
      }
      expect(renderBaselineConversationalLayer(input)).toEqual({
        wording: expected,
      });
    }
  });

  it('keeps baseline wording unchanged, deterministic, and non-mutating', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze(['Great — Brisbane.']),
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.origin,
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

    const first = renderBaselineConversationalLayer(input);
    const second = renderBaselineConversationalLayer(input);
    const third = renderBaselineConversationalLayer(structuredClone(input));

    expect(first).toEqual({ wording: expected });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(first.wording).toBe(`Great, Brisbane it is. ${FOLLOW_UPS.origin}`);
    expect(input).toEqual(before);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.plan)).toBe(true);
  });
});
