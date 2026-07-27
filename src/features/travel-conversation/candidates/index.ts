import type { ConversationState } from '../types';
import { extractDateCandidates, extractDurationCandidates } from './dates';
import { extractLocationCandidates } from './locations';
import {
  extractPreferenceCandidates,
  extractServiceCandidates,
  extractTravellerCandidates,
} from './services';
import type { CandidateBundle } from './types';

export type { CandidateBundle, LocationCandidate, DateCandidate } from './types';

/** Stage 3 — Independent candidate extraction (no state mutation). */
export function extractCandidates(
  text: string,
  now: Date,
  previous: ConversationState,
): CandidateBundle {
  return {
    locations: extractLocationCandidates(text),
    dates: extractDateCandidates(text, now, previous),
    durations: extractDurationCandidates(text),
    services: extractServiceCandidates(text),
    travellers: extractTravellerCandidates(text),
    preferences: extractPreferenceCandidates(text),
  };
}
