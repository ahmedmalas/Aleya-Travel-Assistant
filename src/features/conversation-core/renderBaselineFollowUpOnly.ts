/**
 * Phase 15E — follow-up-only conversational lead-in renderer.
 *
 * Eligible plans have empty acknowledgements and a non-null follow-up.
 * Neutral continuation is excluded. Supported follow-ups are matched by exact
 * catalogue wording already present on the plan; the follow-up question is
 * preserved byte-for-byte after a short deterministic lead-in.
 *
 * Unknown follow-up strings pass through unchanged.
 * Does not import catalogue modules, inspect state, or mutate input.
 *
 * Not exported from index.ts.
 */

export type RenderBaselineFollowUpOnlyInput = Readonly<{
  followUpQuestion: string;
}>;

/**
 * Exact supported follow-up wording → short conversational lead-in.
 * Keys are the complete deterministic follow-up strings.
 */
const FOLLOW_UP_ONLY_LEAD_INS: Readonly<Record<string, string>> = {
  'Where would you like to travel?': "Let's start with the destination.",
  'Where will you be travelling from?': 'First,',
  'When would you like to depart?': 'And',
  'When would you like to return?': 'And',
  'How many adults will be travelling?': 'For flights,',
  'How many guests will be staying?': 'For the stay,',
  'What kinds of activities are you interested in?': 'For activities,',
  'What type of dining are you looking for?': 'For dining,',
};

/**
 * Render a follow-up-only reply with an optional short lead-in.
 *
 * Output for supported follow-ups:
 * `{lead-in} {byte-identical follow-up question}`
 *
 * Unknown follow-ups return the question unchanged.
 */
export function renderBaselineFollowUpOnly(
  input: RenderBaselineFollowUpOnlyInput,
): string {
  const followUpQuestion = input.followUpQuestion;
  const leadIn = FOLLOW_UP_ONLY_LEAD_INS[followUpQuestion];
  if (leadIn === undefined) {
    return followUpQuestion;
  }
  return `${leadIn} ${followUpQuestion}`;
}
