import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationalLayerRenderer } from '../conversationalLayerContracts';
import {
  createConversationalRendererRegistry,
  selectConversationalLayerRenderer,
} from '../conversationalRendererRegistry';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';

/**
 * Phase 13K — conversational renderer registry characterisation.
 *
 * Proves explicit immutable renderer lookup without runtime selection wiring.
 */

const ROOT = process.cwd();
const REGISTRY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/conversationalRendererRegistry.ts',
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

describe('phase 13K — conversationalRendererRegistry', () => {
  it('contains renderer references only — no state, objective, style, or runtime logic', () => {
    const source = readFileSync(REGISTRY_SOURCE, 'utf8');

    expect(source.includes('ConversationalLayerRenderer')).toBe(true);
    expect(source.includes('ConversationCoreState')).toBe(false);
    expect(source.includes('stateUpdate')).toBe(false);
    expect(source.includes('ConversationalLayerInput')).toBe(false);
    expect(source.includes('ConversationReplyPlan')).toBe(false);
    expect(source.includes('selectConversationalObjective')).toBe(false);
    expect(source.includes('followUpQuestion')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('styleProfile')).toBe(false);
    expect(source.includes('renderConversationReplyPlan')).toBe(false);
    expect(source.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(source.includes('invokeConversationalLayerRenderer')).toBe(false);
    expect(source.includes('fallback')).toBe(false);
    expect(source.includes('default')).toBe(false);
    expect(source.includes('OpenAI')).toBe(false);
    expect(source.includes('LLM')).toBe(false);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'conversationalRendererRegistry',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'conversationalRendererRegistry',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'conversationalRendererRegistry',
      ),
    ).toBe(false);
  });

  it('registers a single baseline renderer and returns its exact reference', () => {
    const registry = createConversationalRendererRegistry({
      baseline: renderBaselineConversationalLayer,
    });

    expect(Object.isFrozen(registry)).toBe(true);
    expect(registry.baseline).toBe(renderBaselineConversationalLayer);
    expect(selectConversationalLayerRenderer(registry, 'baseline')).toBe(
      renderBaselineConversationalLayer,
    );
  });

  it('registers multiple renderers and preserves each exact reference', () => {
    const custom: ConversationalLayerRenderer = () => ({
      wording: 'custom',
    });
    const another: ConversationalLayerRenderer = () => ({
      wording: 'another',
    });

    const registry = createConversationalRendererRegistry({
      baseline: renderBaselineConversationalLayer,
      custom,
      another,
    });

    expect(selectConversationalLayerRenderer(registry, 'baseline')).toBe(
      renderBaselineConversationalLayer,
    );
    expect(selectConversationalLayerRenderer(registry, 'custom')).toBe(custom);
    expect(selectConversationalLayerRenderer(registry, 'another')).toBe(
      another,
    );
    expect(registry.baseline).toBe(renderBaselineConversationalLayer);
    expect(registry.custom).toBe(custom);
    expect(registry.another).toBe(another);
  });

  it('returns null for an unknown id and supports an empty registry', () => {
    const empty = createConversationalRendererRegistry({});
    expect(Object.isFrozen(empty)).toBe(true);
    expect(Object.keys(empty)).toEqual([]);
    expect(selectConversationalLayerRenderer(empty, 'baseline')).toBeNull();

    const registry = createConversationalRendererRegistry({
      baseline: renderBaselineConversationalLayer,
    });
    expect(selectConversationalLayerRenderer(registry, 'missing')).toBeNull();
    expect(selectConversationalLayerRenderer(registry, '')).toBeNull();
  });

  it('does not invoke renderers during registration or lookup', () => {
    const renderer = vi.fn<ConversationalLayerRenderer>(() => ({
      wording: 'should-not-run',
    }));

    const registry = createConversationalRendererRegistry({
      probe: renderer,
    });
    expect(renderer).not.toHaveBeenCalled();

    const selected = selectConversationalLayerRenderer(registry, 'probe');
    expect(selected).toBe(renderer);
    expect(renderer).not.toHaveBeenCalled();

    const missing = selectConversationalLayerRenderer(registry, 'absent');
    expect(missing).toBeNull();
    expect(renderer).not.toHaveBeenCalled();
  });

  it('leaves a frozen registry unmodified and repeats the same reference', () => {
    const custom: ConversationalLayerRenderer = () => ({ wording: 'x' });
    const registry = createConversationalRendererRegistry({
      baseline: renderBaselineConversationalLayer,
      custom,
    });
    const before = { ...registry };

    const first = selectConversationalLayerRenderer(registry, 'custom');
    const second = selectConversationalLayerRenderer(registry, 'custom');
    const third = selectConversationalLayerRenderer(registry, 'baseline');

    expect(first).toBe(custom);
    expect(second).toBe(first);
    expect(third).toBe(renderBaselineConversationalLayer);
    expect(registry).toEqual(before);
    expect(Object.isFrozen(registry)).toBe(true);

    expect(() => {
      (registry as { custom?: ConversationalLayerRenderer }).custom = () => ({
        wording: 'mutated',
      });
    }).toThrow();
    expect(registry.custom).toBe(custom);
  });

  it('follows normal record construction for duplicate object keys before creation', () => {
    const first: ConversationalLayerRenderer = () => ({ wording: 'first' });
    const second: ConversationalLayerRenderer = () => ({ wording: 'second' });

    const entries = {
      shared: first,
      shared: second,
    };
    expect(entries.shared).toBe(second);

    const registry = createConversationalRendererRegistry(entries);
    expect(selectConversationalLayerRenderer(registry, 'shared')).toBe(second);
    expect(registry.shared).toBe(second);
    expect(registry.shared).not.toBe(first);
  });
});
