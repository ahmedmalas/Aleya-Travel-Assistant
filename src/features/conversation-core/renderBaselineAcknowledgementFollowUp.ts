import { transformBaselineAcknowledgement } from './transformBaselineAcknowledgement';

/**
 * Phase 15C — acknowledgement-plus-follow-up conversational transition.
 *
 * Transforms the single acknowledgement expression via
 * transformBaselineAcknowledgement, then joins it to the unchanged
 * follow-up question with a single space. Does not alter follow-up wording,
 * selection, meaning of the acknowledgement beyond the existing transform,
 * state, classification, objective IDs, or catalogue keys.
 *
 * Not exported from index.ts.
 */

export type RenderBaselineAcknowledgementFollowUpInput = Readonly<{
  acknowledgement: string;
  followUpQuestion: string;
}>;

/**
 * Render a transformed acknowledgement followed by an unchanged follow-up.
 *
 * Output structure: `{transformed acknowledgement} {unchanged follow-up}`.
 */
export function renderBaselineAcknowledgementFollowUp(
  input: RenderBaselineAcknowledgementFollowUpInput,
): string {
  const transformedAcknowledgement = transformBaselineAcknowledgement(
    input.acknowledgement,
  );
  return `${transformedAcknowledgement} ${input.followUpQuestion}`;
}
