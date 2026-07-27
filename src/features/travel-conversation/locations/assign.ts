import type { ClarificationField } from '../types';
import { extractLocationCandidates, parseStandalonePlace } from './candidates';
import type { LocationCandidate, LocationRoleAssignment } from './types';

function pickBest(
  candidates: LocationCandidate[],
  role: LocationCandidate['roleHint'],
): LocationCandidate | undefined {
  return candidates
    .filter((c) => c.roleHint === role)
    .sort((a, b) => b.strength - a.strength)[0];
}

/**
 * Clarification-context resolution runs BEFORE any generic role defaults.
 * A standalone place answer fills only the active pending field.
 */
export function resolveClarificationAnswer(
  text: string,
  pendingClarification: ClarificationField | undefined,
): LocationRoleAssignment | undefined {
  if (pendingClarification !== 'origin' && pendingClarification !== 'destination') {
    return undefined;
  }

  const standalone = parseStandalonePlace(text);
  if (!standalone) return undefined;

  if (pendingClarification === 'origin') {
    return {
      origin: standalone,
      explicitChanges: ['origin'],
    };
  }

  return {
    destination: standalone,
    explicitChanges: ['destination'],
  };
}

/**
 * Assign each candidate a final role and produce at most one value per slot.
 */
export function assignLocationRoles(candidates: LocationCandidate[]): LocationRoleAssignment {
  const assignment: LocationRoleAssignment = { explicitChanges: [] };

  const origin = pickBest(candidates, 'origin');
  const destination = pickBest(candidates, 'destination');
  const accommodation = pickBest(candidates, 'accommodation');

  if (origin) {
    assignment.origin = origin.normalized;
    assignment.explicitChanges.push('origin');
  }

  if (destination) {
    assignment.destination = destination.normalized;
    assignment.destinationInferred = destination.source.includes('infer');
    if (!assignment.destinationInferred) {
      assignment.explicitChanges.push('destination');
    } else {
      assignment.explicitChanges.push('destination');
    }
  }

  if (accommodation) {
    assignment.accommodationArea = accommodation.normalized;
    assignment.explicitChanges.push('accommodationArea');
  }

  // Never let origin and destination collapse to the same city
  if (
    assignment.origin &&
    assignment.destination &&
    assignment.origin.toLowerCase() === assignment.destination.toLowerCase()
  ) {
    // Prefer keeping the stronger non-inferred destination cue; drop weaker origin clash
    const dest = pickBest(candidates, 'destination');
    if (dest?.source.includes('infer')) {
      assignment.destination = undefined;
      assignment.explicitChanges = assignment.explicitChanges.filter((f) => f !== 'destination');
    } else {
      assignment.origin = undefined;
      assignment.explicitChanges = assignment.explicitChanges.filter((f) => f !== 'origin');
    }
  }

  assignment.explicitChanges = Array.from(new Set(assignment.explicitChanges));
  return assignment;
}

/**
 * Full location role pipeline for one turn:
 * read pending clarification → candidates → assign → (clarification wins for standalones)
 */
export function resolveLocations(
  text: string,
  pendingClarification?: ClarificationField,
): LocationRoleAssignment {
  // 1. Active clarification answers must win before any destination-default behaviour
  const clarified = resolveClarificationAnswer(text, pendingClarification);
  if (clarified) return clarified;

  // 2. Cue-based candidates → role assignment
  const candidates = extractLocationCandidates(text);
  return assignLocationRoles(candidates);
}
