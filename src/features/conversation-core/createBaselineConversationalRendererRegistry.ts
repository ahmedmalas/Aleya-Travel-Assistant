import type { ConversationalLayerRenderer } from './conversationalLayerContracts';
import { createConversationalRendererRegistry } from './conversationalRendererRegistry';
import { renderBaselineConversationalLayer } from './renderBaselineConversationalLayer';

/**
 * Phase 13M — isolated factory for the initial conversational renderer registry.
 *
 * Registers only the deterministic baseline renderer under the id "baseline"
 * through createConversationalRendererRegistry. Preserves the exact
 * renderBaselineConversationalLayer reference.
 *
 * Does not invoke the renderer, does not choose an alternate renderer, and does
 * not introduce runtime reply integration.
 */
export function createBaselineConversationalRendererRegistry(): Readonly<
  Record<string, ConversationalLayerRenderer>
> {
  return createConversationalRendererRegistry({
    baseline: renderBaselineConversationalLayer,
  });
}
