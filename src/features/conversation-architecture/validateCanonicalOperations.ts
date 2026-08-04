/**
 * Phase 3 — pure Canonical Validator.
 *
 * Validates ProposedOperation[] against a state snapshot.
 * Does not mutate state or invent user meaning.
 */

import type { ConversationCoreState, OpenClarification } from '../conversation-core';
import { isShapeValidPlaceName } from '../conversation-interpretation/placeResolution';
import type { Clarification } from './clarification';
import { clarificationFromOpenClarification } from './clarification';
import type { ProposedOperation } from './canonicalOperations';
import {
  validationResultSchema,
  type ClarificationAction,
  type ValidationResult,
} from './validationResult';

export type ValidateCanonicalOperationsInput = {
  operations: ProposedOperation[];
  currentState: ConversationCoreState;
};

const PLACE_MUTATION_OPS = new Set([
  'set_origin',
  'replace_origin',
  'clear_origin',
  'set_destinations',
  'replace_destination',
  'add_destination',
  'remove_destination',
  'reorder_destinations',
  'set_return_point',
  'clear_return_point',
  'set_trip_structure',
  'set_leg_duration',
]);

const LOW_CONFIDENCE = 0.55;

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

function asPlace(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stopsOf(state: ConversationCoreState): string[] {
  return state.destinationStops ?? [];
}

function findStopIndex(stops: string[], name: string): number {
  const key = placeKey(name);
  return stops.findIndex((stop) => placeKey(stop) === key);
}

function buildNarrowedClarification(
  open: OpenClarification,
): Clarification {
  const attemptCount = (open.attemptCount ?? 1) + 1;
  const id = `${open.id}#narrow-${attemptCount}`;
  const projected = clarificationFromOpenClarification({
    ...open,
    id,
    parentClarificationId: open.id,
    attemptCount,
    prompt:
      open.type === 'place_role'
        ? `${open.subject} as your starting point?`
        : `Could you confirm ${open.subject}?`,
    options:
      open.type === 'place_role' ? ['origin', 'first_destination'] : open.options,
  });
  if (projected === null) {
    throw new Error('Failed to project narrowed clarification');
  }
  return {
    ...projected,
    status: 'narrowed',
    parentClarificationId: open.id,
    attemptCount,
  };
}

function validatePlaceCreatable(place: string): string | null {
  if (!isShapeValidPlaceName(place)) {
    return `Place shape invalid: ${place}`;
  }
  return null;
}

function validateOne(
  op: ProposedOperation,
  state: ConversationCoreState,
  ctx: {
    preserveDates: boolean;
    preserveTravellers: boolean;
    preservePreferences: boolean;
    preservePlaces: Set<string>;
  },
): { ok: true } | { ok: false; reason: string } {
  if (PLACE_MUTATION_OPS.has(op.op) && op.confidence < LOW_CONFIDENCE) {
    return {
      ok: false,
      reason: `Low confidence (${op.confidence}) — refusing unsafe place commit`,
    };
  }

  switch (op.op) {
    case 'no_state_change':
      return { ok: true };

    case 'preserve_dates':
    case 'preserve_travellers':
    case 'preserve_preferences':
    case 'preserve_places':
      return { ok: true };

    case 'set_origin':
    case 'replace_origin': {
      const place = asPlace(op.value);
      if (!place) return { ok: false, reason: 'Origin value missing' };
      const shape = validatePlaceCreatable(place);
      if (shape) return { ok: false, reason: shape };
      if (op.op === 'replace_origin' && state.origin === null) {
        // Allow as creatable set when replace used with null prior.
        return { ok: true };
      }
      return { ok: true };
    }

    case 'clear_origin':
      if (state.origin === null) {
        return { ok: false, reason: 'No origin to clear' };
      }
      return { ok: true };

    case 'set_destinations': {
      if (!Array.isArray(op.value) || op.value.length === 0) {
        return { ok: false, reason: 'set_destinations requires a non-empty array' };
      }
      for (const item of op.value) {
        if (typeof item !== 'string') {
          return { ok: false, reason: 'set_destinations entries must be strings' };
        }
        const shape = validatePlaceCreatable(item);
        if (shape) return { ok: false, reason: shape };
      }
      return { ok: true };
    }

    case 'add_destination': {
      const place = asPlace(op.value);
      if (!place) return { ok: false, reason: 'add_destination value missing' };
      const shape = validatePlaceCreatable(place);
      if (shape) return { ok: false, reason: shape };
      const stops = stopsOf(state);
      if (stops.some((s) => placeKey(s) === placeKey(place))) {
        return { ok: false, reason: `Destination already present: ${place}` };
      }
      return { ok: true };
    }

    case 'remove_destination': {
      const place = asPlace(op.value);
      if (!place) return { ok: false, reason: 'remove_destination value missing' };
      if (ctx.preservePlaces.has(placeKey(place))) {
        return {
          ok: false,
          reason: `preserve_places blocks removal of ${place}`,
        };
      }
      const stops = stopsOf(state);
      const byIndex =
        typeof op.resolvedEntity.id === 'number' ? op.resolvedEntity.id : -1;
      if (byIndex >= 0) {
        if (byIndex >= stops.length) {
          return {
            ok: false,
            reason: `Stop index out of range: ${byIndex}`,
          };
        }
        return { ok: true };
      }
      if (findStopIndex(stops, place) === -1) {
        if (state.destination && placeKey(state.destination) === placeKey(place)) {
          return { ok: true };
        }
        return {
          ok: false,
          reason: `Remove target not found in destinationStops: ${place}`,
        };
      }
      return { ok: true };
    }

    case 'replace_destination': {
      const value = op.value as { from?: unknown; to?: unknown } | string;
      let from: string | null = null;
      let to: string | null = null;
      if (typeof value === 'string') {
        to = asPlace(value);
        from =
          typeof op.resolvedEntity.id === 'number'
            ? stopsOf(state)[op.resolvedEntity.id] ?? null
            : state.destination;
      } else if (value && typeof value === 'object') {
        from = asPlace(value.from);
        to = asPlace(value.to);
      }
      if (!to) return { ok: false, reason: 'replace_destination missing to' };
      const shape = validatePlaceCreatable(to);
      if (shape) return { ok: false, reason: shape };
      const stops = stopsOf(state);
      if (from) {
        if (ctx.preservePlaces.has(placeKey(from))) {
          return {
            ok: false,
            reason: `preserve_places blocks replace of ${from}`,
          };
        }
        const idx =
          typeof op.resolvedEntity.id === 'number'
            ? op.resolvedEntity.id
            : findStopIndex(stops, from);
        if (idx < 0 && !(state.destination && placeKey(state.destination) === placeKey(from))) {
          return {
            ok: false,
            reason: `Replace from-target not found: ${from}`,
          };
        }
        if (idx >= stops.length) {
          return { ok: false, reason: `Stop index out of range: ${idx}` };
        }
      } else if (stops.length === 0 && state.destination === null) {
        return {
          ok: false,
          reason: 'replace_destination has no existing destination to replace',
        };
      }
      return { ok: true };
    }

    case 'reorder_destinations': {
      if (!Array.isArray(op.value) || op.value.length < 2) {
        return {
          ok: false,
          reason: 'reorder_destinations requires ≥2 places',
        };
      }
      const stops = stopsOf(state);
      if (stops.length < 2) {
        return {
          ok: false,
          reason: 'Cannot reorder — fewer than 2 destinationStops on state',
        };
      }
      const stopKeys = new Set(stops.map(placeKey));
      for (const item of op.value) {
        if (typeof item !== 'string' || !stopKeys.has(placeKey(item))) {
          return {
            ok: false,
            reason: `Reorder references unknown stop: ${String(item)}`,
          };
        }
      }
      return { ok: true };
    }

    case 'set_return_point': {
      const place = asPlace(op.value);
      if (!place) return { ok: false, reason: 'set_return_point value missing' };
      const shape = validatePlaceCreatable(place);
      if (shape) return { ok: false, reason: shape };
      return { ok: true };
    }

    case 'clear_return_point':
      return { ok: true };

    case 'set_trip_structure': {
      if (
        op.value !== 'one_way' &&
        op.value !== 'return' &&
        op.value !== 'multi_city' &&
        op.value !== null
      ) {
        return { ok: false, reason: `Invalid tripStructure: ${String(op.value)}` };
      }
      if (op.value === 'multi_city') {
        // Will be checked after batch simulation in post-pass; allow if set_destinations present in batch.
        return { ok: true };
      }
      return { ok: true };
    }

    case 'set_leg_duration': {
      const value = op.value as { placeId?: unknown; nights?: unknown };
      const nights = typeof value?.nights === 'number' ? value.nights : NaN;
      if (!Number.isFinite(nights) || nights < 0) {
        return { ok: false, reason: 'set_leg_duration requires non-negative nights' };
      }
      const stops = stopsOf(state);
      if (typeof value.placeId === 'number') {
        if (value.placeId < 0 || value.placeId >= stops.length) {
          return { ok: false, reason: 'set_leg_duration stop index invalid' };
        }
      } else if (typeof value.placeId === 'string') {
        if (findStopIndex(stops, value.placeId) === -1) {
          return {
            ok: false,
            reason: `set_leg_duration place not in stops: ${value.placeId}`,
          };
        }
      } else {
        return { ok: false, reason: 'set_leg_duration missing placeId' };
      }
      return { ok: true };
    }

    case 'set_departure_date':
    case 'set_return_date': {
      if (ctx.preserveDates && op.value === null) {
        return { ok: false, reason: 'preserve_dates blocks clearing dates' };
      }
      if (typeof op.value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(op.value)) {
        return { ok: false, reason: `Date not ISO YYYY-MM-DD: ${op.value}` };
      }
      return { ok: true };
    }

    case 'clear_date':
      if (ctx.preserveDates) {
        return { ok: false, reason: 'preserve_dates blocks clear_date' };
      }
      return { ok: true };

    case 'set_traveller_count':
      if (ctx.preserveTravellers && op.value === null) {
        return {
          ok: false,
          reason: 'preserve_travellers blocks clearing travellers',
        };
      }
      return { ok: true };

    case 'set_service':
    case 'set_preference':
      if (ctx.preservePreferences && op.value === null) {
        return {
          ok: false,
          reason: 'preserve_preferences blocks clearing preferences',
        };
      }
      return { ok: true };

    case 'reset_trip':
    case 'restart_conversation':
      return { ok: true };

    case 'undo_last_commit':
      return {
        ok: false,
        reason: 'Undo rejected — commit history stack not available',
      };

    case 'confirm_clarification': {
      if (!state.openClarification?.blocking) {
        return { ok: false, reason: 'No blocking clarification to confirm' };
      }
      const option = asPlace(op.value);
      if (!option || !state.openClarification.options.includes(option)) {
        return {
          ok: false,
          reason: `confirm_clarification option not in open options: ${String(op.value)}`,
        };
      }
      return { ok: true };
    }

    case 'reject_clarification':
    case 'supersede_clarification':
    case 'narrow_clarification':
      if (!state.openClarification?.blocking) {
        return {
          ok: false,
          reason: `${op.op} requires a blocking openClarification`,
        };
      }
      return { ok: true };

    default:
      return { ok: false, reason: `Unsupported operation: ${op.op}` };
  }
}

/**
 * Pure validator — accept/reject each proposed operation with reasons.
 */
export function validateCanonicalOperations(
  input: ValidateCanonicalOperationsInput,
): ValidationResult {
  const { operations, currentState } = input;
  const accepted: ProposedOperation[] = [];
  const rejected: Array<{ op: ProposedOperation; reason: string }> = [];
  const reasons: string[] = ['Phase 3 Canonical Validator'];

  const preserveDates = operations.some((o) => o.op === 'preserve_dates');
  const preserveTravellers = operations.some(
    (o) => o.op === 'preserve_travellers',
  );
  const preservePreferences = operations.some(
    (o) => o.op === 'preserve_preferences',
  );
  const preservePlaces = new Set<string>();
  for (const o of operations) {
    if (o.op === 'preserve_places') {
      if (Array.isArray(o.value)) {
        for (const item of o.value) {
          if (typeof item === 'string') preservePlaces.add(placeKey(item));
        }
      }
    }
  }

  const ctx = {
    preserveDates,
    preserveTravellers,
    preservePreferences,
    preservePlaces,
  };

  for (const operation of operations) {
    // Ambiguous place-role: reject place mutations that are not clarification lifecycle.
    if (
      currentState.openClarification?.blocking &&
      currentState.openClarification.type === 'place_role' &&
      PLACE_MUTATION_OPS.has(operation.op) &&
      operation.op !== 'set_trip_structure' &&
      !operation.dependsOnClarification &&
      operation.confidence < 0.75
    ) {
      rejected.push({
        op: operation,
        reason:
          'Blocking place-role clarification — refusing non-dependent place mutation',
      });
      continue;
    }

    // When narrow is proposed, reject silent place commits in the same batch.
    const hasNarrow = operations.some((o) => o.op === 'narrow_clarification');
    if (
      hasNarrow &&
      PLACE_MUTATION_OPS.has(operation.op) &&
      operation.op !== 'set_trip_structure'
    ) {
      rejected.push({
        op: operation,
        reason:
          'narrow_clarification present — refusing place commit until role is confirmed',
      });
      continue;
    }

    const result = validateOne(operation, currentState, ctx);
    if (result.ok) {
      accepted.push(operation);
      reasons.push(`accept:${operation.op}`);
    } else {
      rejected.push({ op: operation, reason: result.reason });
      reasons.push(`reject:${operation.op} — ${result.reason}`);
    }
  }

  let clarificationAction: ClarificationAction = 'none';
  let narrowedClarification: Clarification | null = null;
  let clarificationNeeded = currentState.openClarification?.blocking === true;

  if (accepted.some((o) => o.op === 'confirm_clarification')) {
    clarificationAction = 'clear';
    clarificationNeeded = false;
  } else if (accepted.some((o) => o.op === 'supersede_clarification')) {
    clarificationAction = 'supersede';
    clarificationNeeded = false;
  } else if (accepted.some((o) => o.op === 'narrow_clarification')) {
    clarificationAction = 'narrow';
    clarificationNeeded = true;
    if (currentState.openClarification) {
      narrowedClarification = buildNarrowedClarification(
        currentState.openClarification,
      );
    }
  } else if (accepted.some((o) => o.op === 'reject_clarification')) {
    clarificationAction = 'keep';
    clarificationNeeded = true;
  } else if (currentState.openClarification?.blocking) {
    clarificationAction = 'keep';
    clarificationNeeded = true;
  }

  // multi_city coherence: if accepting set_trip_structure multi_city, ensure enough stops after accepted sets.
  const setStops = accepted.find((o) => o.op === 'set_destinations');
  const structure = accepted.find((o) => o.op === 'set_trip_structure');
  if (structure?.value === 'multi_city') {
    const projectedStops = Array.isArray(setStops?.value)
      ? (setStops.value as string[])
      : stopsOf(currentState);
    if (projectedStops.length < 2) {
      const idx = accepted.indexOf(structure);
      if (idx >= 0) {
        accepted.splice(idx, 1);
        rejected.push({
          op: structure,
          reason: 'multi_city requires ≥2 destinationStops after apply',
        });
        reasons.push('reject:set_trip_structure — insufficient stops');
      }
    }
  }

  return validationResultSchema.parse({
    accepted,
    rejected,
    clarificationNeeded,
    clarificationAction,
    narrowedClarification,
    reasons,
  });
}
