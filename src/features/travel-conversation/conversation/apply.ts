/**
 * Stage 4 — Apply validated trip changes to canonical state (domain tools only).
 * Combines contextual option selections with explicit extraction.
 */

import { assignRoles } from '../assign';
import { extractCandidates } from '../candidates';
import { mergeTravelState } from '../merge';
import type { ConversationState, TravelPatch, TravelServiceKind } from '../types';
import { createEmptyConversationState } from '../types';
import type { CombinedValidatedSelections } from '../contextual-reference';
import { clearActiveOptionSet } from '../contextual-reference';
import type { ConversationContext, ExecutedResult, TurnGoal } from './contracts';
import { setTripType } from './runtime';

function clone(state: ConversationState): ConversationState {
  return {
    ...state,
    services: [...state.services],
    excludedServices: [...state.excludedServices],
    preferences: [...state.preferences],
    changeHistory: [...state.changeHistory],
    lastChangedFields: [...state.lastChangedFields],
  };
}

function isServiceKind(value: unknown): value is TravelServiceKind {
  return (
    value === 'flights' ||
    value === 'accommodation' ||
    value === 'car_hire' ||
    value === 'transfers' ||
    value === 'activities'
  );
}

export function applyValidatedTripChanges(input: {
  ctx: ConversationContext;
  goals: TurnGoal[];
  state: ConversationState;
  combinedSelections?: CombinedValidatedSelections | null;
}): { state: ConversationState; results: ExecutedResult[] } {
  let state = clone(input.state);
  const results: ExecutedResult[] = [];
  const text = input.ctx.normalizedMessage.replace(
    /^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.]?\s+/i,
    '',
  );

  if (input.goals.some((g) => g.kind === 'start_new_trip')) {
    const preserved = state.preferences.filter((p) =>
      /budget|luxury|window|aisle/i.test(p),
    );
    state = createEmptyConversationState();
    state.preferences = preserved;
    setTripType(undefined);
    clearActiveOptionSet();
    results.push({ type: 'reset_trip', detail: 'cleared obsolete trip', ok: true });
  }

  if (input.goals.some((g) => g.kind === 'provide_trip_facts' || g.kind === 'start_new_trip')) {
    const candidates = extractCandidates(text, input.ctx.now, state, input.ctx.awaitingField);
    const patch = assignRoles(candidates, state, input.ctx.awaitingField);
    state = mergeTravelState(state, patch, input.ctx.now, text);
    results.push({
      type: 'apply_validated_trip_changes',
      detail: state.lastChangedFields.join(',') || 'none',
      ok: true,
    });
  }

  // Contextual + explicit option selections (validated) → canonical merge
  const combined = input.combinedSelections;
  if (combined?.ok) {
    if (combined.category === 'service') {
      const add = combined.selectedValues.filter(isServiceKind);
      const remove = combined.excludedOptionIds
        .map((id) => combined.selectedValues.includes(id) ? null : id)
        .filter(Boolean) as string[];
      // Prefer selected values; exclusions already stripped in validate
      const patch: TravelPatch = {
        servicesAdd: add.length ? add : undefined,
        servicesRemove: combined.excludedOptionIds.filter(isServiceKind),
        explicitChanges: add.length || combined.excludedOptionIds.length ? ['services'] : [],
        clearFields: [],
      };
      // "none of them" → no servicesAdd; leave state as-is
      state = mergeTravelState(state, patch, input.ctx.now, text);
      results.push({
        type: 'apply_contextual_services',
        detail: add.join(',') || (combined.excludedOptionIds.length ? 'none' : 'none'),
        ok: true,
      });
      void remove;
    } else if (combined.category === 'trip_type') {
      const value = combined.selectedValues[0];
      if (value === 'one_way' || value === 'return') {
        setTripType(value);
        const patch: TravelPatch = {
          preferencesAdd: [value === 'one_way' ? 'one-way' : 'return'],
          explicitChanges: ['preferences'],
          clearFields: [],
        };
        state = mergeTravelState(state, patch, input.ctx.now, text);
        results.push({ type: 'set_trip_type', detail: value, ok: true });
      }
    } else if (combined.category === 'preference') {
      const prefs = combined.selectedValues.map(String);
      if (prefs.length) {
        const patch: TravelPatch = {
          preferencesAdd: prefs,
          explicitChanges: ['preferences'],
          clearFields: [],
        };
        state = mergeTravelState(state, patch, input.ctx.now, text);
        results.push({
          type: 'apply_contextual_preferences',
          detail: prefs.join(','),
          ok: true,
        });
      }
    } else if (combined.category === 'location') {
      const label = String(combined.selectedValues[0] ?? '');
      if (label) {
        const field = input.ctx.awaitingField;
        const patch: TravelPatch = {
          explicitChanges: [],
          clearFields: [],
        };
        if (field === 'origin') {
          patch.origin = { value: label, source: 'explicit', confirmed: true };
          patch.explicitChanges.push('origin');
        } else if (field === 'destination') {
          patch.destination = { value: label, source: 'explicit', confirmed: true };
          patch.explicitChanges.push('destination');
        } else {
          patch.destination = { value: label, source: 'explicit', confirmed: true };
          patch.explicitChanges.push('destination');
        }
        state = mergeTravelState(state, patch, input.ctx.now, text);
        results.push({
          type: 'apply_contextual_location',
          detail: label,
          ok: true,
        });
      }
    } else if (combined.category === 'traveller') {
      const count = Number(combined.selectedValues[0]);
      if (Number.isFinite(count) && count > 0) {
        const patch: TravelPatch = {
          travellers: { value: count, source: 'explicit', confirmed: true },
          explicitChanges: ['travellers'],
          clearFields: [],
        };
        state = mergeTravelState(state, patch, input.ctx.now, text);
        results.push({ type: 'set_travellers', detail: String(count), ok: true });
      }
    }
  }

  for (const goal of input.goals) {
    if (goal.kind === 'add_services') {
      // Prefer combined selections when already applied; still merge explicit goal adds
      if (combined?.ok && combined.category === 'service') continue;
      const patch: TravelPatch = {
        servicesAdd: goal.services,
        explicitChanges: ['services'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.ctx.now, text);
      results.push({
        type: 'add_services',
        detail: goal.services.join(','),
        ok: true,
      });
    }
    if (goal.kind === 'remove_services') {
      if (combined?.ok && combined.category === 'service') continue;
      const patch: TravelPatch = {
        servicesRemove: goal.services,
        explicitChanges: ['services'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.ctx.now, text);
      results.push({
        type: 'remove_services',
        detail: goal.services.join(','),
        ok: true,
      });
    }
    if (goal.kind === 'set_travellers') {
      const patch: TravelPatch = {
        travellers: { value: goal.count, source: 'explicit', confirmed: true },
        explicitChanges: ['travellers'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.ctx.now, text);
      results.push({ type: 'set_travellers', detail: String(goal.count), ok: true });
    }
    if (goal.kind === 'set_nights') {
      const patch: TravelPatch = {
        durationNights: { value: goal.nights, source: 'explicit', confirmed: true },
        explicitChanges: ['durationNights'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.ctx.now, text);
      results.push({ type: 'set_nights', detail: String(goal.nights), ok: true });
    }
    if (goal.kind === 'set_area') {
      const patch: TravelPatch = {
        accommodationArea: { value: goal.area, source: 'explicit', confirmed: true },
        servicesAdd: ['accommodation'],
        explicitChanges: ['accommodationArea', 'services'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.ctx.now, text);
      results.push({ type: 'set_area', detail: goal.area, ok: true });
    }
    if (goal.kind === 'set_trip_type') {
      if (combined?.ok && combined.category === 'trip_type') continue;
      setTripType(goal.value);
      const patch: TravelPatch = {
        preferencesAdd: [goal.value === 'one_way' ? 'one-way' : 'return'],
        explicitChanges: ['preferences'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.ctx.now, text);
      results.push({ type: 'set_trip_type', detail: goal.value, ok: true });
    }
  }

  return { state, results };
}
