import type {
  ActiveSearchSession,
  ConsultantTrace,
  TranscriptTurn,
} from './types';

let transcript: TranscriptTurn[] = [];
let searchSession: ActiveSearchSession | null = null;
let traces: ConsultantTrace[] = [];

export function resetConsultantRuntime(): void {
  transcript = [];
  searchSession = null;
  traces = [];
}

export function getTranscript(): TranscriptTurn[] {
  return transcript;
}

export function appendTurn(turn: TranscriptTurn): void {
  transcript = [...transcript, turn].slice(-40);
}

export function clearTranscript(): void {
  transcript = [];
}

export function lastAleyaReply(): string | undefined {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.role === 'aleya') return transcript[i]!.text;
  }
  return undefined;
}

export function lastAleyaQuestion(): string | undefined {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const t = transcript[i];
    if (t?.role === 'aleya' && /\?/.test(t.text)) return t.text;
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

export function getConsultantTraces(): ConsultantTrace[] {
  return traces;
}

export function pushConsultantTrace(trace: ConsultantTrace): void {
  traces = [...traces, trace].slice(-50);
}

export function clearConsultantTraces(): void {
  traces = [];
}
