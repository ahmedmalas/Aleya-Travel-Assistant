import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createBaselineConversationalRendererRegistry } from '../createBaselineConversationalRendererRegistry';
import { selectConversationalLayerRenderer } from '../conversationalRendererRegistry';
import { executeConversationalLayerRenderer } from '../executeConversationalLayerRenderer';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 13M — baseline conversational renderer registry factory characterisation.
 */

const ROOT = process.cwd();
const FACTORY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createBaselineConversationalRendererRegistry.ts',
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
const BASELINE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);

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

describe('phase 13M — createBaselineConversationalRendererRegistry', () => {
  it('creates the registry through the existing factory with only the baseline entry', () => {
    const source = readFileSync(FACTORY_SOURCE, 'utf8');

    expect(source.includes('createConversationalRendererRegistry')).toBe(true);
    expect(source.includes('renderBaselineConversationalLayer')).toBe(true);
    expect(source.includes('baseline: renderBaselineConversationalLayer')).toBe(
      true,
    );
    expect(source.includes('fallback')).toBe(false);
    expect(source.includes('default')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('selectConversationalObjective')).toBe(false);
    expect(source.includes('generateConversationReply')).toBe(false);
    expect(source.includes('processConversationTurn')).toBe(false);
    expect(source.includes('OpenAI')).toBe(false);
    expect(source.includes('LLM')).toBe(false);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'createBaselineConversationalRendererRegistry',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'createBaselineConversationalRendererRegistry',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'createBaselineConversationalRendererRegistry',
      ),
    ).toBe(false);
  });

  it('returns an immutable registry with exactly one baseline entry', () => {
    const registry = createBaselineConversationalRendererRegistry();

    expect(Object.keys(registry)).toEqual(['baseline']);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(registry.baseline).toBe(renderBaselineConversationalLayer);
    expect(selectConversationalLayerRenderer(registry, 'baseline')).toBe(
      renderBaselineConversationalLayer,
    );
    expect(selectConversationalLayerRenderer(registry, 'missing')).toBeNull();
    expect(selectConversationalLayerRenderer(registry, 'custom')).toBeNull();

    expect(() => {
      (registry as { baseline?: typeof renderBaselineConversationalLayer }).baseline =
        (() => ({ wording: 'mutated' })) as typeof renderBaselineConversationalLayer;
    }).toThrow();
    expect(registry.baseline).toBe(renderBaselineConversationalLayer);
  });

  it('allows baseline execution that matches deterministic rendering', () => {
    const registry = createBaselineConversationalRendererRegistry();
    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const input = buildConversationalLayerInput(replyPlan);

    const output = executeConversationalLayerRenderer(
      registry,
      'baseline',
      input,
    );

    expect(output).toEqual({
      wording: expectedActivatedBaselineReply(replyPlan),
    });
    expect(output).toEqual(renderBaselineConversationalLayer(input));
    expect(
      executeConversationalLayerRenderer(registry, 'unknown', input),
    ).toBeNull();
  });

  it('produces equivalent independent registries on repeated factory calls', () => {
    const first = createBaselineConversationalRendererRegistry();
    const second = createBaselineConversationalRendererRegistry();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(first.baseline).toBe(renderBaselineConversationalLayer);
    expect(second.baseline).toBe(renderBaselineConversationalLayer);
    expect(first.baseline).toBe(second.baseline);
  });

  it('does not invoke the baseline renderer during registry creation', () => {
    const factorySource = readFileSync(FACTORY_SOURCE, 'utf8');
    expect(factorySource.includes('renderBaselineConversationalLayer(')).toBe(
      false,
    );
    expect(factorySource.includes('invokeConversationalLayerRenderer')).toBe(
      false,
    );
    expect(factorySource.includes('executeConversationalLayerRenderer')).toBe(
      false,
    );

    const registry = createBaselineConversationalRendererRegistry();
    expect(registry.baseline).toBe(renderBaselineConversationalLayer);
    expect(Object.keys(registry)).toEqual(['baseline']);
    expect(readFileSync(BASELINE_SOURCE, 'utf8')).toContain(
      'ConversationalLayerRenderer',
    );
  });
});
