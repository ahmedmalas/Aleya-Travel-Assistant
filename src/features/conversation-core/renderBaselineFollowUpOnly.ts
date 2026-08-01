/**
 * Phase 15E — follow-up-only conversational lead-in renderer.
 * Phase 15F — grammatical refinement: lead-ins are complete sentences so the
 * original capitalized follow-up question can begin naturally.
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
 * Exact supported follow-up wording → short complete-sentence lead-in.
 * Keys are the complete deterministic follow-up strings.
 */
const FOLLOW_UP_ONLY_LEAD_INS: Readonly<Record<string, string>> = {
  'Where would you like to travel?': "Let's start with the destination.",
  'Where will you be travelling from?':
    "Let's begin with where you're travelling from.",
  'When would you like to depart?': 'Now for the timing.',
  'When would you like to return?': 'And for your return.',
  'How many adults will be travelling?': 'Now for the flights.',
  'How many guests will be staying?': 'Now for the accommodation.',
  'What kinds of activities are you interested in?':
    "Let's look at activities.",
  'What type of dining are you looking for?': 'Now for dining.',
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
