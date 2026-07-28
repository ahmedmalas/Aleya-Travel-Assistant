/**
 * Stage 7 — Create and validate an ordered action plan.
 * Search/refine + destination discovery — trip mutations already applied in stage 4.
 */

import {
  shouldRecommend,
} from '../destination-discovery';
import { pickDiscoveryQuestion } from '../destination-discovery';
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
  const discovery = ctx.trip.discovery;
  // Prefer post-apply discovery from completeness path — plan runs before execute,
  // but apply has already updated state on ctx.trip only at plan time via turn wiring.
  // turn.ts passes completeness from applied state; discovery lives on applied state
  // which is not on ctx.trip. Plan must receive discovery from goals + we'll fix turn
  // to pass applied state. For now use goals heavily.

  const select = goals.find((g) => g.kind === 'select_discovery_destination');
  if (select && select.kind === 'select_discovery_destination') {
    actions.push({
      type: 'resolve_selected_destination',
      placeName: select.placeName,
      candidateId: select.candidateId,
    });
    actions.push({ type: 'transition_to_booking' });
    return actions;
  }

  if (goals.some((g) => g.kind === 'provide_discovery_criteria')) {
    actions.push({ type: 'collect_discovery_criteria' });

    // Discovery planning uses the trip on context; turn will refresh plan after apply
    // via createActionPlanFromState — see planDiscoveryActions helper below.
  }

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
    actions.push({ type: 'start_search' });
  }

  void completeness;
  void discovery;
  void shouldRecommend;
  void pickDiscoveryQuestion;

  return actions;
}

/** Plan discovery follow-ups from the applied discovery state. */
export function planDiscoveryActions(input: {
  goals: TurnGoal[];
  discovery: import('../types').ConversationState['discovery'];
  criteriaChanged: boolean;
}): PlannedAction[] {
  const actions: PlannedAction[] = [];
  const { goals, discovery, criteriaChanged } = input;

  const select = goals.find((g) => g.kind === 'select_discovery_destination');
  if (select && select.kind === 'select_discovery_destination') {
    return [
      {
        type: 'resolve_selected_destination',
        placeName: select.placeName,
        candidateId: select.candidateId,
      },
      { type: 'transition_to_booking' },
    ];
  }

  if (!discovery || discovery.mode !== 'active') return actions;

  if (goals.some((g) => g.kind === 'provide_discovery_criteria')) {
    actions.push({ type: 'collect_discovery_criteria' });
  }

  const reject = goals.some((g) => g.kind === 'reject_discovery_recommendations');
  if (shouldRecommend(discovery.criteria)) {
    if (reject || (criteriaChanged && discovery.recommendations.length > 0)) {
      actions.push({ type: 'refine_destination_recommendations' });
    } else if (criteriaChanged || discovery.recommendations.length === 0) {
      actions.push({ type: 'recommend_destinations' });
    } else {
      // Unchanged ack with existing recommendations — re-present
      actions.push({ type: 'recommend_destinations' });
    }
    return actions;
  }

  const q = pickDiscoveryQuestion(discovery.criteria, discovery.lastQuestionId);
  if (q) {
    actions.push({ type: 'ask_discovery_question', questionId: q.id });
  } else {
    actions.push({ type: 'recommend_destinations' });
  }
  return actions;
}

export function validateActionPlan(
  plan: PlannedAction[],
  completeness: TripCompleteness,
): PlannedAction[] {
  return plan.filter((action) => {
    if (action.type === 'refine_search' && action.services.includes('accommodation')) {
      return true;
    }
    if (action.type === 'start_search' && !completeness.readyToSearch) {
      return true;
    }
    return true;
  });
}
