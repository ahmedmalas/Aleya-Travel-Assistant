import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createConversationalLayerInput,
  type ConversationalLayerOutput,
  type ConversationalLayerRenderer,
} from '../conversationalLayerContracts';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { invokeConversationalLayerRenderer } from '../invokeConversationalLayerRenderer';
import { REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL } from '../referenceConversationalStyleProfiles';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';

/**
 * Phase 13J — conversational renderer invocation boundary characterisation.
 *
 * Proves substitution of ConversationalLayerRenderer implementations without
 * wiring the conversational layer into runtime reply generation.
 */

const ROOT = process.cwd();
const INVOKE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/invokeConversationalLayerRenderer.ts',
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

describe('phase 13J — invokeConversationalLayerRenderer', () => {
  it('contains no selection, rendering, or runtime integration logic', () => {
    const source = readFileSync(INVOKE_SOURCE, 'utf8');

    expect(source.includes('renderConversationReplyPlan')).toBe(false);
    expect(source.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(source.includes('selectConversationalObjective')).toBe(false);
    expect(source.includes('selectConversationFollowUpQuestion')).toBe(false);
    expect(source.includes('assembleConversationReplyPlan')).toBe(false);
    expect(source.includes('followUpQuestion')).toBe(false);
    expect(source.includes('catalogueWording')).toBe(false);
    expect(source.includes('ConversationCoreState')).toBe(false);
    expect(source.includes('stateUpdate')).toBe(false);
    expect(source.includes('input.message')).toBe(false);
    expect(source.includes('fallback')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('return renderer(input)')).toBe(true);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'invokeConversationalLayerRenderer',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'invokeConversationalLayerRenderer',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'invokeConversationalLayerRenderer',
      ),
    ).toBe(false);
  });

  it('invokes the baseline renderer and returns its wording-only output', () => {
    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const input = buildConversationalLayerInput(replyPlan);

    const output = invokeConversationalLayerRenderer(
      renderBaselineConversationalLayer,
      input,
    );

    expect(output).toEqual({
      wording: renderConversationReplyPlan(replyPlan),
    });
    expect(output).toEqual(
      renderBaselineConversationalLayer(input),
    );
    expect(Object.keys(output)).toEqual(['wording']);
  });

  it('invokes a custom renderer and forwards exact input and output references', () => {
    const replyPlan = plan({
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    });
    const input = buildConversationalLayerInput(replyPlan);
    const customOutput: ConversationalLayerOutput = Object.freeze({
      wording: 'custom-wording',
    });

    const renderer = vi.fn<ConversationalLayerRenderer>((received) => {
      expect(received).toBe(input);
      return customOutput;
    });

    const output = invokeConversationalLayerRenderer(renderer, input);

    expect(renderer).toHaveBeenCalledTimes(1);
    expect(renderer).toHaveBeenCalledWith(input);
    expect(output).toBe(customOutput);
    expect(output.wording).toBe('custom-wording');
  });

  it('supports nullable objective and optional style profiles without inspecting them', () => {
    const replyPlan = plan({
      acknowledgements: ['Perfect.'],
      followUpQuestion: null,
      messageInterpreted: true,
    });

    const nullObjectiveInput = createConversationalLayerInput(replyPlan, null);
    expect(nullObjectiveInput.objective).toBeNull();
    expect(
      invokeConversationalLayerRenderer(
        renderBaselineConversationalLayer,
        nullObjectiveInput,
      ),
    ).toEqual({ wording: 'Perfect, got it.' });

    const withStyle = buildConversationalLayerInput(
      replyPlan,
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );
    expect(withStyle.styleProfile).toBe(
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );
    expect(
      invokeConversationalLayerRenderer(
        renderBaselineConversationalLayer,
        withStyle,
      ),
    ).toEqual({ wording: 'Perfect, got it.' });

    const withoutStyle = buildConversationalLayerInput(replyPlan);
    expect(withoutStyle.styleProfile).toBeUndefined();
    expect(
      invokeConversationalLayerRenderer(
        renderBaselineConversationalLayer,
        withoutStyle,
      ),
    ).toEqual({ wording: 'Perfect, got it.' });
  });

  it('leaves a frozen input unmodified and does not mutate renderer output', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze(['Great — Brisbane.']),
        followUpQuestion: FOLLOW_UPS.activities,
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
    const customOutput: ConversationalLayerOutput = Object.freeze({
      wording: 'unchanged-output',
    });
    const outputBefore = structuredClone(customOutput);

    const renderer: ConversationalLayerRenderer = () => customOutput;
    const output = invokeConversationalLayerRenderer(renderer, input);

    expect(output).toBe(customOutput);
    expect(input).toEqual(before);
    expect(customOutput).toEqual(outputBefore);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(customOutput)).toBe(true);
  });

  it('propagates renderer failure unchanged', () => {
    const input = buildConversationalLayerInput(
      plan({ followUpQuestion: FOLLOW_UPS.origin }),
    );
    const failure = new Error('renderer-failed');
    const renderer: ConversationalLayerRenderer = () => {
      throw failure;
    };

    expect(() =>
      invokeConversationalLayerRenderer(renderer, input),
    ).toThrow(failure);
  });

  it('does not select a fallback when a custom renderer is supplied', () => {
    const input = buildConversationalLayerInput(
      plan({
        acknowledgements: ['Great — Brisbane.'],
        followUpQuestion: FOLLOW_UPS.destination,
        messageInterpreted: true,
      }),
    );
    const baselineWording = renderBaselineConversationalLayer(input).wording;
    const customOutput: ConversationalLayerOutput = {
      wording: 'alternative-only',
    };
    const renderer = vi.fn<ConversationalLayerRenderer>(() => customOutput);

    const output = invokeConversationalLayerRenderer(renderer, input);

    expect(renderer).toHaveBeenCalledTimes(1);
    expect(output).toBe(customOutput);
    expect(output.wording).not.toBe(baselineWording);
    expect(output.wording).toBe('alternative-only');
  });
});
