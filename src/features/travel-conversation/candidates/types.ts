import type { FieldSource, TravelServiceKind } from '../types';

export type LocationRoleHint = 'origin' | 'destination' | 'accommodation' | 'unspecified';

export type LocationCandidate = {
  kind: 'location';
  raw: string;
  normalized: string;
  roleHint: LocationRoleHint;
  cue: string;
  index: number;
  confidence: number;
  source: FieldSource;
};

export type DateCandidate = {
  kind: 'date';
  raw: string;
  roleHint: 'departure' | 'return' | 'approximate' | 'unspecified';
  cue: string;
  index: number;
  confidence: number;
  source: FieldSource;
  /** Parsed payload when known at extraction time. */
  exact?: { day: number; month: number; year: number; isoDate: string; label: string };
  approximate?: { period: 'early' | 'mid' | 'late'; month: number; year: number; label: string };
  returnWeekday?: number;
  weekend?: boolean;
};

export type DurationCandidate = {
  kind: 'duration';
  nights: number;
  raw: string;
  index: number;
  confidence: number;
  source: FieldSource;
};

export type ServiceCandidate = {
  kind: 'service';
  service: TravelServiceKind;
  operation: 'add' | 'remove';
  raw: string;
  index: number;
  confidence: number;
  source: FieldSource;
};

export type TravellerCandidate = {
  kind: 'travellers';
  count: number;
  raw: string;
  index: number;
  confidence: number;
  source: FieldSource;
};

export type PreferenceCandidate = {
  kind: 'preference';
  value: string;
  raw: string;
  index: number;
  confidence: number;
  source: FieldSource;
};

export type Candidate =
  | LocationCandidate
  | DateCandidate
  | DurationCandidate
  | ServiceCandidate
  | TravellerCandidate
  | PreferenceCandidate;

export type CandidateBundle = {
  locations: LocationCandidate[];
  dates: DateCandidate[];
  durations: DurationCandidate[];
  services: ServiceCandidate[];
  travellers: TravellerCandidate[];
  preferences: PreferenceCandidate[];
};
