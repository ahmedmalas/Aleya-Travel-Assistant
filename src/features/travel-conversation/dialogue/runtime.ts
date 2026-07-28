import type { ActiveSearchSession, DialogueTrace, TranscriptTurn } from './types';

let transcript: TranscriptTurn[] = [];
let searchSession: ActiveSearchSession | null = null;
let traces: DialogueTrace[] = [];

export function getTranscriptTurns(): TranscriptTurn[] {
  return transcript;
}

export function setTranscriptTurns(next: TranscriptTurn[]): void {
  transcript = next;
}

export function getActiveSearchSession(): ActiveSearchSession | null {
  return searchSession;
}

export function setActiveSearchSession(next: ActiveSearchSession | null): void {
  searchSession = next;
}

export function getTraceList(): DialogueTrace[] {
  return traces;
}

export function setTraceList(next: DialogueTrace[]): void {
  traces = next;
}

export function resetDialogueRuntime(): void {
  transcript = [];
  searchSession = null;
  traces = [];
}
