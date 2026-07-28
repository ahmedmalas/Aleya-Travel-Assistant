import {
  getTranscriptTurns,
  setTranscriptTurns,
} from './runtime';
import type { TranscriptTurn } from './types';

export function getTranscript(): TranscriptTurn[] {
  return getTranscriptTurns();
}

export function appendTurn(turn: TranscriptTurn): void {
  setTranscriptTurns([...getTranscriptTurns(), turn].slice(-40));
}

export function clearTranscript(): void {
  setTranscriptTurns([]);
}

/** Last clarifying / open question Aleya asked (heuristic from prior assistant turns). */
export function lastAleyaQuestion(): string | undefined {
  const turns = getTranscriptTurns();
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const t = turns[i];
    if (t.role !== 'aleya') continue;
    if (/\?/.test(t.text)) {
      return t.text;
    }
  }
  return undefined;
}
