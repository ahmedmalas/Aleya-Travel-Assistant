/**
 * Engine runtime memory — transcript, search session, awaiting field, trip type,
 * active structured option set. Not canonical trip state. Not a dialogue planner.
 */

import type { TripField } from '../types';
import {
  getActiveOptionSet,
  resetContextualReferenceRuntime,
} from '../contextual-reference';
import type {
  ActiveSearchSession,
  TranscriptTurn,
  TurnTrace,
} from './contracts';

let transcript: TranscriptTurn[] = [];
let searchSession: ActiveSearchSession | null = null;
let awaitingField: TripField | undefined;
let tripType: 'one_way' | 'return' | undefined;
let searchOffered = false;
let traces: TurnTrace[] = [];

export function resetConversationRuntime(): void {
  transcript = [];
  searchSession = null;
  awaitingField = undefined;
  tripType = undefined;
  searchOffered = false;
  traces = [];
  resetContextualReferenceRuntime();
}

export { getActiveOptionSet };

export function getTranscript(): TranscriptTurn[] {
  return transcript;
}

export function appendTurn(turn: TranscriptTurn): void {
  transcript = [...transcript, turn].slice(-40);
}

export function lastAleyaReply(): string | undefined {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.role === 'aleya') return transcript[i]!.text;
  }
  return undefined;
}

export function getSearchSession(): ActiveSearchSession | null {
  return searchSession;
}

export function setSearchSession(next: ActiveSearchSession | null): void {
  searchSession = next;
}

export function isSearchActive(): boolean {
  return Boolean(searchSession);
}

export function getAwaitingField(): TripField | undefined {
  return awaitingField;
}

export function setAwaitingField(next: TripField | undefined): void {
  awaitingField = next;
}

export function getTripType(): 'one_way' | 'return' | undefined {
  return tripType;
}

export function setTripType(next: 'one_way' | 'return' | undefined): void {
  tripType = next;
}

export function wasSearchOffered(): boolean {
  return searchOffered;
}

export function setSearchOffered(next: boolean): void {
  searchOffered = next;
}

export function getConversationTraces(): TurnTrace[] {
  return traces;
}

export function pushConversationTrace(trace: TurnTrace): void {
  traces = [...traces, trace].slice(-50);
}

export function clearConversationTraces(): void {
  traces = [];
}
