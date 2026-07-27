/**
 * Runtime conversation-engine instrumentation.
 * Captures post-requirements → compose branch selection.
 */

export type ComposeBranch =
  | 'greeting'
  | 'thanks'
  | 'new_conversation'
  | 'summary_incomplete'
  | 'summary_review'
  | 'final_confirmation_locked'
  | 'final_confirmation_needs_clarification'
  | 'start_search'
  | 'start_search_incomplete'
  | 'booking_generation'
  | 'itinerary_generation'
  | 'pricing_request'
  | 'hotel_recommendation'
  | 'flight_recommendation'
  | 'decline_search'
  | 'search_offer'
  | 'needs_clarification'
  | 'clarification_question'
  | 'rejection'
  | 'ack_still_have'
  | 'ack_updated'
  | 'ack_saved_ready'
  | 'ack_saved_incomplete'
  | 'empty_prompt';

export type ComposeTraceEntry = {
  at: string;
  message: string;
  normalized?: string;
  messageClass?: string;
  phaseBefore?: string;
  phaseAfter?: string;
  pendingClarification?: string;
  composeBranch?: ComposeBranch;
  activateSearch?: boolean;
  replyPreview?: string;
};

const MAX = 40;
const traces: ComposeTraceEntry[] = [];

export function pushComposeTrace(entry: ComposeTraceEntry): void {
  traces.push(entry);
  if (traces.length > MAX) traces.shift();

  const line = [
    '[aleya-compose-trace]',
    `messageClass=${entry.messageClass ?? '?'}`,
    `phase=${entry.phaseBefore ?? '?'}→${entry.phaseAfter ?? '?'}`,
    `activateSearch=${entry.activateSearch ? 'yes' : 'no'}`,
    `branch=${entry.composeBranch ?? '?'}`,
    `msg=${JSON.stringify(entry.message)}`,
  ].join(' ');

  // eslint-disable-next-line no-console
  console.info(line);

  if (typeof window !== 'undefined') {
    const w = window as Window & { __ALEYA_COMPOSE_TRACE__?: ComposeTraceEntry[] };
    w.__ALEYA_COMPOSE_TRACE__ = [...traces];
  }
}

export function getComposeTraces(): ComposeTraceEntry[] {
  return [...traces];
}

export function clearComposeTraces(): void {
  traces.length = 0;
  if (typeof window !== 'undefined') {
    const w = window as Window & { __ALEYA_COMPOSE_TRACE__?: ComposeTraceEntry[] };
    w.__ALEYA_COMPOSE_TRACE__ = [];
  }
}
