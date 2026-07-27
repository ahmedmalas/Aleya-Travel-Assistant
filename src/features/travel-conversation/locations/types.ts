import type { ClarificationField } from '../types';

export type LocationRole = 'origin' | 'destination' | 'accommodation';

/** A place mention found in the user message before role finalisation. */
export type LocationCandidate = {
  raw: string;
  normalized: string;
  /** Cue-derived hint; unspecified means role must come from clarification or pairing. */
  roleHint: LocationRole | 'unspecified';
  /** Higher wins when two candidates compete for the same role. */
  strength: number;
  source: string;
};

export type LocationRoleAssignment = {
  origin?: string;
  destination?: string;
  accommodationArea?: string;
  /** True when destination was inferred from a stay area, not stated as the trip city. */
  destinationInferred?: boolean;
  explicitChanges: string[];
};

export type ExtractLocationsOptions = {
  pendingClarification?: ClarificationField;
};
