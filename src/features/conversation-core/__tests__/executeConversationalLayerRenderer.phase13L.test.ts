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
import {
  createConversationalRendererRegistry,
} from '../conversationalRendererRegistry';
import { executeConversationalLayerRenderer } from '../executeConversationalLayerRenderer';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL } from '../referenceConversationalStyleProfiles';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 13L — conversational renderer execution boundary characterisation.
 *
 * Proves registry lookup + invocation composition without runtime wiring.
 */

const ROOT = process.cwd();
const EXECUTE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/executeConversationalLayerRenderer.ts',
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

describe('phase 13L — executeConversationalLayerRenderer', () => {
  it('owns only registry lookup + invocation composition — no wording or runtime wiring', () => {
    const source = readFileSync(EXECUTE_SOURCE, 'utf8');

    expect(source.includes('selectConversationalLayerRenderer')).toBe(true);
    expect(source.includes('invokeConversationalLayerRenderer')).toBe(true);
    expect(source.includes('renderConversationReplyPlan')).toBe(false);
    expect(source.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(source.includes('selectConversationalObjective')).toBe(false);
    expect(source.includes('followUpQuestion')).toBe(false);
    expect(source.includes('catalogueWording')).toBe(false);
    expect(source.includes('styleProfile')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('fallback')).toBe(false);
    expect(source.includes('default')).toBe(false);
    expect(source.includes('ConversationCoreState')).toBe(false);
    expect(source.includes('generateConversationReply')).toBe(false);
    expect(source.includes('processConversationTurn')).toBe(false);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'executeConversationalLayerRenderer',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'executeConversationalLayerRenderer',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'executeConversationalLayerRenderer',
      ),
    ).toBe(false);
  });

  it('executes the baseline renderer for a known id', () => {
    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const input = buildConversationalLayerInput(replyPlan);
    const registry = createConversationalRendererRegistry({
      baseline: renderBaselineConversationalLayer,
    });

    const output = executeConversationalLayerRenderer(
      registry,
      'baseline',
      input,
    );

    expect(output).toEqual({
      wording: expectedActivatedBaselineReply(replyPlan),
    });
    expect(output).toEqual(renderBaselineConversationalLayer(input));
  });

  it('executes a custom renderer and forwards exact input and output references', () => {
    const input = buildConversationalLayerInput(
      plan({ followUpQuestion: FOLLOW_UPS.destination }),
    );
    const customOutput: ConversationalLayerOutput = Object.freeze({
      wording: 'custom-executed',
    });
    const custom = vi.fn<ConversationalLayerRenderer>((received) => {
      expect(received).toBe(input);
      return customOutput;
    });
    const unselected = vi.fn<ConversationalLayerRenderer>(() => ({
      wording: 'should-not-run',
    }));
    const registry = createConversationalRendererRegistry({
      custom,
      unselected,
      baseline: renderBaselineConversationalLayer,
    });

    const output = executeConversationalLayerRenderer(
      registry,
      'custom',
      input,
    );

    expect(output).toBe(customOutput);
    expect(custom).toHaveBeenCalledTimes(1);
    expect(custom).toHaveBeenCalledWith(input);
    expect(unselected).not.toHaveBeenCalled();
  });

  it('returns null for an unknown id or empty registry without invoking renderers', () => {
    const selected = vi.fn<ConversationalLayerRenderer>(() => ({
      wording: 'should-not-run',
    }));
    const registry = createConversationalRendererRegistry({
      baseline: selected,
    });
    const input = buildConversationalLayerInput(
      plan({ followUpQuestion: FOLLOW_UPS.activities }),
    );

    expect(
      executeConversationalLayerRenderer(registry, 'missing', input),
    ).toBeNull();
    expect(selected).not.toHaveBeenCalled();

    const empty = createConversationalRendererRegistry({});
    expect(
      executeConversationalLayerRenderer(empty, 'baseline', input),
    ).toBeNull();
    expect(selected).not.toHaveBeenCalled();
  });

  it('supports nullable objective and optional styleProfile without inspecting them', () => {
    const replyPlan = plan({
      acknowledgements: ['Perfect.'],
      acknowledgementEvent: null,
      followUpQuestion: null,
      messageInterpreted: true,
    });
    const registry = createConversationalRendererRegistry({
      baseline: renderBaselineConversationalLayer,
    });

    const nullObjective = createConversationalLayerInput(replyPlan, null);
    expect(nullObjective.objective).toBeNull();
    expect(
      executeConversationalLayerRenderer(registry, 'baseline', nullObjective),
    ).toEqual({ wording: 'Perfect, got it.' });

    const withStyle = buildConversationalLayerInput(
      replyPlan,
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );
    expect(withStyle.styleProfile).toBe(
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );
    expect(
      executeConversationalLayerRenderer(registry, 'baseline', withStyle),
    ).toEqual({ wording: 'Perfect, got it.' });

    const withoutStyle = buildConversationalLayerInput(replyPlan);
    expect(withoutStyle.styleProfile).toBeUndefined();
    expect(
      executeConversationalLayerRenderer(registry, 'baseline', withoutStyle),
    ).toEqual({ wording: 'Perfect, got it.' });
  });

  it('leaves frozen registry and input unmodified', () => {
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
    const registry = createConversationalRendererRegistry({
      baseline: renderBaselineConversationalLayer,
    });
    const inputBefore = structuredClone(input);
    const registryBefore = { ...registry };

    const output = executeConversationalLayerRenderer(
      registry,
      'baseline',
      input,
    );

    expect(output).toEqual({
      wording: expectedActivatedBaselineReply(replyPlan),
    });
    expect(input).toEqual(inputBefore);
    expect(registry).toEqual(registryBefore);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(registry)).toBe(true);
  });

  it('propagates renderer failure unchanged', () => {
    const failure = new Error('execute-renderer-failed');
    const renderer: ConversationalLayerRenderer = () => {
      throw failure;
    };
    const registry = createConversationalRendererRegistry({
      failing: renderer,
    });
    const input = buildConversationalLayerInput(
      plan({ followUpQuestion: FOLLOW_UPS.destination }),
    );

    expect(() =>
      executeConversationalLayerRenderer(registry, 'failing', input),
    ).toThrow(failure);
  });
});
