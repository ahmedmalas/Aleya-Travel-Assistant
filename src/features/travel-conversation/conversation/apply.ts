/**
 * Stage 4 — Apply validated trip changes to canonical state (domain tools only).
 */

import { assignRoles } from '../assign';
import { extractCandidates } from '../candidates';
import { mergeTravelState } from '../merge';
import type { ConversationState, TravelPatch } from '../types';
import { createEmptyConversationState } from '../types';
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

export function applyValidatedTripChanges(input: {
  ctx: ConversationContext;
  goals: TurnGoal[];
  state: ConversationState;
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

  for (const goal of input.goals) {
    // Services add/remove come from extract→assign→merge only (provide_trip_facts).
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
