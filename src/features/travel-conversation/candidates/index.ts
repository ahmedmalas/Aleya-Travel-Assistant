import type { ConversationState, TripField } from '../types';
import { extractDateCandidates, extractDurationCandidates } from './dates';
import { extractLocationCandidates } from './locations';
import {
  extractPreferenceCandidates,
  extractServiceCandidates,
  extractTravellerCandidates,
} from './services';
import type { CandidateBundle } from './types';

export type { CandidateBundle, LocationCandidate, DateCandidate } from './types';

/** Independent candidate extraction (no state mutation). */
export function extractCandidates(
  text: string,
  now: Date,
  previous: ConversationState,
  awaitingField?: TripField,
): CandidateBundle {
  return {
    locations: extractLocationCandidates(text, awaitingField, {
      origin: previous.origin?.value,
      destination: previous.destination?.value,
    }),
    dates: extractDateCandidates(text, now, previous, awaitingField),
    durations: extractDurationCandidates(text),
    services: extractServiceCandidates(text),
    travellers: extractTravellerCandidates(text),
    preferences: extractPreferenceCandidates(text),
  };
}
