import type {
  ConversationalLayerInput,
  ConversationalLayerOutput,
  ConversationalLayerRenderer,
} from './conversationalLayerContracts';

/**
 * Phase 13J — pure conversational renderer invocation boundary.
 *
 * Executes a supplied ConversationalLayerRenderer with an existing
 * ConversationalLayerInput. Passes the exact input reference through and
 * returns the exact renderer output.
 *
 * Does not inspect the reply plan or objective metadata, does not render
 * wording itself, does not choose an alternate renderer, and does not mutate
 * input or output.
 *
 * Not wired into reply generation or turn processing.
 */
export function invokeConversationalLayerRenderer(
  renderer: ConversationalLayerRenderer,
  input: Readonly<ConversationalLayerInput>,
): ConversationalLayerOutput {
  return renderer(input);
}
