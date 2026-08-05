/**
 * Phase 3 — pure State Committer (diagnostic).
 *
 * Applies only accepted operations to a copied state.
 * Does not mutate the input. Not activated in production.
 */

import type {
  ConversationCoreState,
  ConversationTripLeg,
  OpenClarification,
  TripStructureKind,
} from '../conversation-core';
import { buildTripLegsFromStops } from '../conversation-interpretation/tripStructureSemantics';
import type { Clarification } from './clarification';
import type { ProposedOperation } from './canonicalOperations';
import type { ClarificationAction } from './validationResult';

export type CommitCanonicalOperationsInput = {
  currentState: ConversationCoreState;
  accepted: ProposedOperation[];
  clarificationAction: ClarificationAction;
  narrowedClarification?: Clarification | null;
};

export type CommitCanonicalOperationsResult = {
  /** New canonical state (deep-copied apply). */
  state: ConversationCoreState;
  /** Diagnostic return-point field (not yet on ConversationCoreState). */
  returnPoint: string | null;
  /** Clarification IDs cleared this commit (must not reappear). */
  clearedClarificationIds: string[];
  appliedOperationCount: number;
};

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

function placeKey(value: string): string {
  return asciiFold(value).trim();
}

function cloneState(state: ConversationCoreState): ConversationCoreState {
  return {
    ...state,
    destinationStops: state.destinationStops
      ? [...state.destinationStops]
      : null,
    tripLegs: state.tripLegs
      ? state.tripLegs.map((leg) => ({ ...leg }))
      : null,
    openClarification: state.openClarification
      ? {
          ...state.openClarification,
          options: [...state.openClarification.options],
          placesInOrder: state.openClarification.placesInOrder
            ? [...state.openClarification.placesInOrder]
            : undefined,
        }
      : null,
    transcript: state.transcript.map((entry) => ({ ...entry })),
  };
}

function rebuildLegs(state: ConversationCoreState): void {
  const stops = state.destinationStops;
  if (!stops || stops.length === 0) {
    state.tripLegs = null;
    return;
  }
  state.tripLegs = buildTripLegsFromStops({
    origin: state.origin,
    destinationStops: stops,
    departureDate: state.departureDate,
  }) as ConversationTripLeg[];
  state.destination = stops[0] ?? state.destination;
}

function clarificationFromGeneric(
  clar: Clarification,
): OpenClarification {
  return {
    id: clar.id,
    type:
      clar.issueType === 'role_ambiguity'
        ? 'place_role'
        : clar.domain === 'date'
          ? 'date_anchor'
          : 'generic',
    subject: clar.subject,
    prompt: clar.prompt,
    options: [...clar.options],
    blocking: clar.blocking,
    placesInOrder: clar.placesInOrder ? [...clar.placesInOrder] : undefined,
    parentClarificationId: clar.parentClarificationId,
    attemptCount: clar.attemptCount,
  };
}

function emptyTravelFields(state: ConversationCoreState): void {
  state.origin = null;
  state.destination = null;
  state.destinationStops = null;
  state.tripLegs = null;
  state.tripStructure = null;
  state.departureDate = null;
  state.returnDate = null;
  state.adultCount = null;
  state.childCount = null;
  state.infantCount = null;
  state.flightsRequested = null;
  state.accommodationRequested = null;
  state.carHireRequested = null;
  state.activitiesRequested = null;
  state.restaurantsRequested = null;
  state.restaurantPreference = null;
  state.conversationComplete = null;
  state.searchExecutionRequested = null;
  state.amendmentResumeSearchReady = null;
  state.destinationResolutionStatus = null;
  state.originResolutionStatus = null;
  state.openClarification = null;
}

/**
 * Pure committer — returns a new state; never mutates input.
 */
export function commitCanonicalOperations(
  input: CommitCanonicalOperationsInput,
): CommitCanonicalOperationsResult {
  const next = cloneState(input.currentState);
  let returnPoint: string | null = null;
  const clearedClarificationIds: string[] = [];
  let applied = 0;

  const priorClarId = input.currentState.openClarification?.id ?? null;

  for (const op of input.accepted) {
    switch (op.op) {
      case 'no_state_change':
      case 'preserve_dates':
      case 'preserve_travellers':
      case 'preserve_preferences':
      case 'preserve_places':
        applied += 1;
        break;

      case 'set_origin':
      case 'replace_origin':
        if (typeof op.value === 'string') {
          next.origin = op.value;
          next.originResolutionStatus = 'resolved';
          applied += 1;
        }
        break;

      case 'clear_origin':
        next.origin = null;
        next.originResolutionStatus = null;
        applied += 1;
        break;

      case 'set_destinations':
        if (Array.isArray(op.value)) {
          next.destinationStops = op.value.filter(
            (item): item is string => typeof item === 'string',
          );
          next.destination = next.destinationStops[0] ?? null;
          next.destinationResolutionStatus = next.destination
            ? 'resolved'
            : null;
          if (next.destinationStops.length >= 2) {
            next.tripStructure = 'multi_city';
          }
          applied += 1;
        }
        break;

      case 'add_destination':
        if (typeof op.value === 'string') {
          const stops = next.destinationStops ? [...next.destinationStops] : [];
          if (next.destination && stops.length === 0) {
            stops.push(next.destination);
          }
          stops.push(op.value);
          next.destinationStops = stops;
          next.destination = stops[0] ?? op.value;
          if (stops.length >= 2) next.tripStructure = 'multi_city';
          applied += 1;
        }
        break;

      case 'remove_destination': {
        const stops = next.destinationStops ? [...next.destinationStops] : [];
        let idx =
          typeof op.resolvedEntity.id === 'number' ? op.resolvedEntity.id : -1;
        if (idx < 0 && typeof op.value === 'string') {
          idx = stops.findIndex((s) => placeKey(s) === placeKey(op.value as string));
        }
        if (idx >= 0 && idx < stops.length) {
          stops.splice(idx, 1);
          next.destinationStops = stops.length > 0 ? stops : null;
          next.destination = stops[0] ?? null;
          if ((next.destinationStops?.length ?? 0) < 2 && next.tripStructure === 'multi_city') {
            next.tripStructure = null;
          }
          applied += 1;
        } else if (
          typeof op.value === 'string' &&
          next.destination &&
          placeKey(next.destination) === placeKey(op.value)
        ) {
          next.destination = null;
          next.destinationStops = null;
          applied += 1;
        }
        break;
      }

      case 'replace_destination': {
        const value = op.value as { from?: string; to?: string } | string;
        const stops = next.destinationStops ? [...next.destinationStops] : [];
        let to: string | null = null;
        let from: string | null = null;
        if (typeof value === 'string') {
          to = value;
        } else if (value && typeof value === 'object') {
          to = typeof value.to === 'string' ? value.to : null;
          from = typeof value.from === 'string' ? value.from : null;
        }
        if (!to) break;
        let idx =
          typeof op.resolvedEntity.id === 'number' ? op.resolvedEntity.id : -1;
        if (idx < 0 && from) {
          idx = stops.findIndex((s) => placeKey(s) === placeKey(from));
        }
        if (idx >= 0 && idx < stops.length) {
          stops[idx] = to;
          next.destinationStops = stops;
          next.destination = stops[0] ?? to;
          applied += 1;
        } else if (stops.length === 0 && next.destination) {
          next.destination = to;
          next.destinationStops = [to];
          applied += 1;
        } else if (from === null && stops.length > 0) {
          stops[0] = to;
          next.destinationStops = stops;
          next.destination = to;
          applied += 1;
        }
        break;
      }

      case 'reorder_destinations':
        if (Array.isArray(op.value) && op.value.length >= 2) {
          next.destinationStops = op.value.filter(
            (item): item is string => typeof item === 'string',
          );
          next.destination = next.destinationStops[0] ?? null;
          next.tripStructure = 'multi_city';
          applied += 1;
        }
        break;

      case 'set_return_point':
        if (typeof op.value === 'string') {
          returnPoint = op.value;
          applied += 1;
        }
        break;

      case 'clear_return_point':
        returnPoint = null;
        applied += 1;
        break;

      case 'set_trip_structure':
        if (
          op.value === 'one_way' ||
          op.value === 'return' ||
          op.value === 'multi_city' ||
          op.value === null
        ) {
          next.tripStructure = op.value as TripStructureKind | null;
          applied += 1;
        }
        break;

      case 'set_leg_duration':
        // Duration metadata: adjust returnDate when nights provided and departure known.
        {
          const value = op.value as { nights?: number };
          if (
            typeof value.nights === 'number' &&
            next.departureDate &&
            /^\d{4}-\d{2}-\d{2}$/.test(next.departureDate)
          ) {
            const base = new Date(`${next.departureDate}T00:00:00.000Z`);
            base.setUTCDate(base.getUTCDate() + value.nights);
            next.returnDate = base.toISOString().slice(0, 10);
          }
          applied += 1;
        }
        break;

      case 'set_departure_date':
        if (typeof op.value === 'string' || op.value === null) {
          next.departureDate = op.value as string | null;
          applied += 1;
        }
        break;

      case 'set_return_date':
        if (typeof op.value === 'string' || op.value === null) {
          next.returnDate = op.value as string | null;
          applied += 1;
        }
        break;

      case 'clear_date':
        next.departureDate = null;
        next.returnDate = null;
        applied += 1;
        break;

      case 'set_traveller_count':
        if (op.value && typeof op.value === 'object') {
          const counts = op.value as {
            adultCount?: number | null;
            childCount?: number | null;
            infantCount?: number | null;
          };
          if ('adultCount' in counts) next.adultCount = counts.adultCount ?? null;
          if ('childCount' in counts) next.childCount = counts.childCount ?? null;
          if ('infantCount' in counts) {
            next.infantCount = counts.infantCount ?? null;
          }
          applied += 1;
        }
        break;

      case 'set_service':
        if (op.value && typeof op.value === 'object') {
          const services = op.value as Record<string, boolean | null>;
          if ('flightsRequested' in services) {
            next.flightsRequested = services.flightsRequested ?? null;
          }
          if ('accommodationRequested' in services) {
            next.accommodationRequested =
              services.accommodationRequested ?? null;
          }
          if ('carHireRequested' in services) {
            next.carHireRequested = services.carHireRequested ?? null;
          }
          applied += 1;
        }
        break;

      case 'set_preference':
        if (typeof op.value === 'string' || op.value === null) {
          next.restaurantPreference = op.value as string | null;
          applied += 1;
        }
        break;

      case 'reset_trip':
      case 'restart_conversation':
        emptyTravelFields(next);
        if (priorClarId) clearedClarificationIds.push(priorClarId);
        returnPoint = null;
        applied += 1;
        break;

      case 'confirm_clarification':
      case 'reject_clarification':
      case 'supersede_clarification':
      case 'narrow_clarification':
      case 'undo_last_commit':
        applied += 1;
        break;

      default:
        break;
    }
  }

  rebuildLegs(next);

  // Clarification lifecycle from validator action.
  switch (input.clarificationAction) {
    case 'clear':
    case 'supersede':
      if (priorClarId) clearedClarificationIds.push(priorClarId);
      next.openClarification = null;
      break;
    case 'narrow':
      if (input.narrowedClarification) {
        if (priorClarId) clearedClarificationIds.push(priorClarId);
        next.openClarification = clarificationFromGeneric(
          input.narrowedClarification,
        );
        // Ensure cleared id does not equal new id.
        if (next.openClarification.id === priorClarId) {
          next.openClarification.id = `${priorClarId}#narrow-next`;
        }
      }
      break;
    case 'keep':
      // unchanged
      break;
    case 'none':
      break;
    default:
      break;
  }

  // Safety: cleared IDs must not remain as the open clarification id.
  if (
    next.openClarification &&
    clearedClarificationIds.includes(next.openClarification.id)
  ) {
    next.openClarification = null;
  }

  return {
    state: next,
    returnPoint,
    clearedClarificationIds,
    appliedOperationCount: applied,
  };
}
