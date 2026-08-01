/**
 * Phase 15J — neutral-continuation conversational expression.
 *
 * Matches only the exact canonical neutral prompt already present on the plan
 * and prefixes a short complete-sentence lead-in. The canonical question is
 * preserved byte-for-byte as the trailing substring. Non-matching strings
 * pass through unchanged.
 *
 * Does not import catalogue modules, inspect state, or mutate input.
 *
 * Not exported from index.ts.
 */

export type RenderBaselineNeutralContinuationInput = Readonly<{
  followUpQuestion: string;
}>;

/** Exact canonical neutral prompt owned by the deterministic catalogue. */
export const CANONICAL_NEUTRAL_CONTINUATION_PROMPT =
  'What else should I know about your trip?';

const NEUTRAL_CONTINUATION_LEAD_IN =
  "There's just one more thing I'd like to know.";

/** Exact activated wording for the canonical neutral-continuation prompt. */
export const ACTIVATED_NEUTRAL_CONTINUATION_REPLY =
  `${NEUTRAL_CONTINUATION_LEAD_IN} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}` as const;

/**
 * Render a neutral-continuation reply with a short lead-in when eligible.
 *
 * Output for the canonical prompt:
 * `{lead-in} {byte-identical canonical question}`
 *
 * Any other string returns unchanged.
 */
export function renderBaselineNeutralContinuation(
  input: RenderBaselineNeutralContinuationInput,
): string {
  const followUpQuestion = input.followUpQuestion;
  if (followUpQuestion !== CANONICAL_NEUTRAL_CONTINUATION_PROMPT) {
    return followUpQuestion;
  }
  return ACTIVATED_NEUTRAL_CONTINUATION_REPLY;
}
