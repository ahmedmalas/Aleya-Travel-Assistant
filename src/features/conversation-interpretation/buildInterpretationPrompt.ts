import type { TravelInterpretationContext } from './buildInterpretationContext';

/**
 * Shared consultant-style prompt for the AI semantic interpretation layer.
 * Used by server generateText and the /api/conversation/interpret route.
 */
export function buildInterpretationPrompt(
  context: TravelInterpretationContext,
): string {
  const history =
    context.recentHistory.length === 0
      ? '(none)'
      : context.recentHistory
          .map((turn) => `${turn.role}: ${turn.message}`)
          .join('\n');

  return [
    'You are Aleya’s semantic travel interpretation layer — reason like an experienced travel consultant.',
    'Read the user message together with active missing requirement, full travel state, temporal anchors, and recent history.',
    'Resolve the user’s intended meaning into structured fields. Do not ask follow-up questions in this layer.',
    '',
    'Relative and contextual language MUST be resolved against temporal anchors and conversation state, including:',
    '- weekday-of-week references (e.g. Monday of that week) → ISO date in the anchor week; if filling returnDate and that weekday is before departure, use the same weekday in the following week',
    '- relative durations are ONE semantic class: quantity × unit (day/week/fortnight/night) under frames such as after / in / later / stay for / for',
    '- convert that class to an ISO returnDate = departure (or primary anchor) + day offset (week=7, fortnight=14); do not leave duration as prose',
    '- the day after → anchor + 1 day',
    '- that weekend → Saturday (and prefer returnDate Sunday when return is the active slot and only one date is needed, use Saturday as the stay start / return Sunday when night count is implied)',
    '- same time → copy prior time preference into departureTimePreference or returnTimePreference for the active leg',
    '- the earlier flight → preferences note; do not invent airports',
    '- change it to Friday → correct the active/date-being-discussed field to that weekday in the same week as the current value',
    '- keep everything else → only update the field being changed; leave all other fields null',
    '- completion signals (that\'s it / nothing else / no / all done / that\'s all) while optional follow-ups are open → set conversationComplete true; do not invent new trip fields',
    '- when trip-ready / ready to search when you confirm (conversationComplete already true, or last assistant invited confirm): confirmation class (confirmed / yes / go ahead / proceed / search / looks good) → set confirmation true AND searchExecutionRequested true; do not only restate conversationComplete',
    '- amendment class (change/update/amend + field, or add/remove service), including after search-ready: set amendmentResumeSearchReady true and conversationComplete false; if no replacement value, list the field in reopenFields (origin/destination/dates/adultCount/childCount/infantCount); if replacement supplied, set the new value instead of reopening; add hotel → accommodationRequested true; remove car hire → removals carHire; preserve unaffected fields as null',
    '- traveller counts are ONE semantic class scoped by active requirement: self-party (myself / just me / alone / solo) → adultCount 1; zero-quantity (none / no / zero) on childCount or infantCount → 0 for that slot; bare cardinals fill the active count slot; labeled "N adults/children/infants" always map to those fields',
    '- while childCount or infantCount is the active requirement, "no" / "none" means 0 for that slot — not conversationComplete',
    '- multi-intent service lists (hotel + flights + car hire, etc.): set EVERY recognised service flag true in one turn; tolerate minor spelling mistakes; do not keep only the first service',
    '',
    'Dates must be ISO YYYY-MM-DD when resolvable. Place names as plain strings. Use null when unknown.',
    'Only set fields the user is changing or newly supplying. Null preserves prior canonical state after validation.',
    'Respect active missing requirement for bare answers (a bare place while origin is missing is origin, etc.).',
    'When the last assistant prompt asked what else to know / optional extras, treat brief closers as conversationComplete.',
    'Passenger counts are trip-wide (not flight-only or hotel-only).',
    'Confidence should reflect how clearly the meaning resolved (0.8+ when dates resolve cleanly from anchors).',
    '',
    `Today (ISO): ${context.todayIso}`,
    `Active missing requirement: ${context.activeRequirement}`,
    `Active requirement meaning: ${context.activeRequirementMeaning}`,
    `Temporal anchors JSON: ${JSON.stringify(context.temporalAnchors)}`,
    `Full travel state JSON: ${JSON.stringify(context.travelState)}`,
    `Last assistant message: ${context.lastAssistantMessage ?? '(none)'}`,
    `Previous user message: ${context.lastUserMessageBeforeCurrent ?? '(none)'}`,
    `Recent conversation history:\n${history}`,
    `Current user message: ${context.message}`,
  ].join('\n');
}
