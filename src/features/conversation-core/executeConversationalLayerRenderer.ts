import type {
  ConversationalLayerInput,
  ConversationalLayerOutput,
  ConversationalLayerRenderer,
} from './conversationalLayerContracts';
import { selectConversationalLayerRenderer } from './conversationalRendererRegistry';
import { invokeConversationalLayerRenderer } from './invokeConversationalLayerRenderer';

/**
 * Phase 13L — pure conversational renderer execution boundary.
 *
 * Resolves a renderer from an existing registry through
 * selectConversationalLayerRenderer, then invokes it through
 * invokeConversationalLayerRenderer with the supplied input.
 *
 * Returns null when the renderer id is absent. Does not choose an alternate
 * renderer, does not render wording itself, and does not introduce runtime
 * reply integration.
 */
export function executeConversationalLayerRenderer(
  registry: Readonly<Record<string, ConversationalLayerRenderer>>,
  rendererId: string,
  input: Readonly<ConversationalLayerInput>,
): ConversationalLayerOutput | null {
  const renderer = selectConversationalLayerRenderer(registry, rendererId);
  if (renderer === null) {
    return null;
  }
  return invokeConversationalLayerRenderer(renderer, input);
}
