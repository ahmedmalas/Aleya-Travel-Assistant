/**
 * Runtime conversation-engine instrumentation.
 * Captures intent → compose branch selection without mutating canonical state.
 */

export type ComposeBranch =
  | 'greeting'
  | 'thanks'
  | 'new_conversation'
  | 'summary_incomplete'
  | 'summary_review'
  | 'soft_affirm_ready'
  | 'soft_affirm_needs_clarification'
  | 'final_confirmation_locked'
  | 'final_confirmation_needs_clarification'
  | 'start_search'
  | 'start_search_incomplete'
  | 'booking_generation'
  | 'itinerary_generation'
  | 'pricing_request'
  | 'hotel_recommendation'
  | 'flight_recommendation'
  | 'stage_query'
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
    `pendingClarification=${entry.pendingClarification ?? 'none'}`,
    `branch=${entry.composeBranch ?? '?'}`,
    `msg=${JSON.stringify(entry.message)}`,
  ].join(' ');

  // Browser + Node
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
