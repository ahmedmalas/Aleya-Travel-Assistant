import type { ConversationalLayerRenderer } from './conversationalLayerContracts';

/**
 * Phase 13K — immutable conversational renderer registry.
 *
 * Maps renderer identifiers to supplied ConversationalLayerRenderer
 * implementations. Preserves exact renderer references and supports explicit
 * lookup only.
 *
 * Does not invoke renderers, does not read structured reply inputs, does not
 * choose an alternate renderer, and does not introduce runtime reply
 * integration.
 */

export type ConversationalRendererId = string;

export type ConversationalRendererRegistry = Readonly<
  Record<ConversationalRendererId, ConversationalLayerRenderer>
>;

/**
 * Create an immutable registry from supplied renderer entries.
 * Copies the record surface and freezes it; renderer function references are
 * preserved unchanged.
 */
export function createConversationalRendererRegistry(
  entries: Readonly<
    Record<ConversationalRendererId, ConversationalLayerRenderer>
  >,
): ConversationalRendererRegistry {
  return Object.freeze({ ...entries });
}

/**
 * Look up a renderer by id. Returns the exact registered reference, or null
 * when the id is absent. Does not invoke the renderer.
 */
export function selectConversationalLayerRenderer(
  registry: ConversationalRendererRegistry,
  rendererId: ConversationalRendererId,
): ConversationalLayerRenderer | null {
  if (!Object.prototype.hasOwnProperty.call(registry, rendererId)) {
    return null;
  }
  return registry[rendererId];
}
