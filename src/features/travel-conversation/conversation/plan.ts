/**
 * Stage 7 — Create and validate an ordered action plan.
 * Search/refine only — trip mutations already applied in stage 4.
 */

import type {
  ConversationContext,
  PlannedAction,
  TripCompleteness,
  TurnGoal,
} from './contracts';

export function createActionPlan(input: {
  ctx: ConversationContext;
  goals: TurnGoal[];
  completeness: TripCompleteness;
}): PlannedAction[] {
  const actions: PlannedAction[] = [];
  const { goals, completeness, ctx } = input;

  if (goals.some((g) => g.kind === 'start_new_trip') && ctx.searchSession) {
    actions.push({ type: 'end_search_session' });
  }

  if (goals.some((g) => g.kind === 'refine_flights')) {
    const g = goals.find((x) => x.kind === 'refine_flights');
    if (g && g.kind === 'refine_flights') {
      actions.push({
        type: 'refine_search',
        services: ['flights'],
        filters: g.filters,
      });
    }
  } else if (goals.some((g) => g.kind === 'refine_hotels')) {
    const g = goals.find((x) => x.kind === 'refine_hotels');
    if (g && g.kind === 'refine_hotels') {
      actions.push({
        type: 'refine_search',
        services: ['accommodation'],
        filters: g.filters,
      });
    }
  } else if (
    goals.some((g) => g.kind === 'authorise_search') &&
    !goals.some((g) => g.kind === 'decline_search')
  ) {
    // Always plan start_search when authorised — execute validates readiness
    actions.push({ type: 'start_search' });
  }

  // Decline clears offer flag in execute via absence of start + explicit marker
  void completeness;

  return actions;
}

export function validateActionPlan(
  plan: PlannedAction[],
  completeness: TripCompleteness,
): PlannedAction[] {
  // Keep start_search even when not ready — execute reports block; step asks blocking field.
  // Never invent accommodation/car hire actions here.
  return plan.filter((action) => {
    if (action.type === 'refine_search' && action.services.includes('accommodation')) {
      return true;
    }
    if (action.type === 'start_search' && !completeness.readyToSearch) {
      return true; // retained so authorisation is observed; execute will not start
    }
    return true;
  });
}
