import type {
  ConversationalLayerInput,
  ConversationalLayerOutput,
} from './conversationalLayerContracts';
import { createBaselineConversationalRendererRegistry } from './createBaselineConversationalRendererRegistry';
import { executeConversationalLayerRenderer } from './executeConversationalLayerRenderer';

/**
 * Phase 13N — pure convenience boundary for baseline conversational rendering.
 *
 * Creates the baseline registry through createBaselineConversationalRendererRegistry
 * and executes the explicit "baseline" renderer through
 * executeConversationalLayerRenderer.
 *
 * The baseline registry guarantees "baseline" is present. If execution returns
 * null, this fails explicitly rather than choosing an alternate renderer or
 * inventing wording. Does not inspect structured reply inputs and does not
 * introduce runtime reply integration.
 */
export function executeBaselineConversationalRenderer(
  input: Readonly<ConversationalLayerInput>,
): ConversationalLayerOutput {
  const registry = createBaselineConversationalRendererRegistry();
  const output = executeConversationalLayerRenderer(
    registry,
    'baseline',
    input,
  );
  if (output === null) {
    throw new Error(
      'Baseline conversational renderer was unexpectedly absent from the registry',
    );
  }
  return output;
}
