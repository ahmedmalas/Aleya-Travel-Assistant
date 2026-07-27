import type { ExtractionPatch, FieldValue } from '../types';
import { resolveLocations } from './assign';
import type { ExtractLocationsOptions } from './types';

export type { LocationCandidate, LocationRoleAssignment, ExtractLocationsOptions } from './types';
export { extractLocationCandidates, parseStandalonePlace } from './candidates';
export { assignLocationRoles, resolveClarificationAnswer, resolveLocations } from './assign';

function explicitPlace(name: string): FieldValue<string> {
  return { value: name, source: 'explicit', confirmed: true };
}

function inferredPlace(name: string): FieldValue<string> {
  return { value: name, source: 'inferred', confirmed: false };
}

/**
 * Location extraction + role assignment for the travel conversation engine.
 *
 * Order (mandatory):
 *   read active clarification → extract candidates → assign roles
 *
 * Standalone place replies never default to destination while an origin
 * clarification is pending.
 */
export function extractLocations(
  text: string,
  options: ExtractLocationsOptions = {},
): Partial<ExtractionPatch> {
  const assignment = resolveLocations(text, options.pendingClarification);
  const patch: Partial<ExtractionPatch> = {
    explicitChanges: [...assignment.explicitChanges],
    clearFields: [],
  };

  if (assignment.origin) {
    patch.origin = explicitPlace(assignment.origin);
  }
  if (assignment.destination) {
    patch.destination = assignment.destinationInferred
      ? inferredPlace(assignment.destination)
      : explicitPlace(assignment.destination);
  }
  if (assignment.accommodationArea) {
    patch.accommodationArea = explicitPlace(assignment.accommodationArea);
  }

  return patch;
}
