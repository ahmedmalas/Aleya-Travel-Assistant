import { evaluateClarification } from '../clarify';
import type { ConversationState, TravelServiceKind } from '../types';
import type { ConsultantContext, ConsultantTurnDecision, ValidatedAction } from './types';

/**
 * Validate the decision before mutating state or calling tools.
 * Drops impossible actions; never invents prices/availability/bookings.
 */
export function validateDecision(
  ctx: ConsultantContext,
  decision: ConsultantTurnDecision,
): ConsultantTurnDecision {
  const actions: ValidatedAction[] = [];

  for (const action of decision.actionSequence) {
    if (action.type === 'start_search') {
      // Search requires at least origin+destination+date after merge — checked post-execute too.
      actions.push(action);
      continue;
    }
    actions.push(action);
  }

  return {
    ...decision,
    actionSequence: actions,
    responsePlan: {
      ...decision.responsePlan,
      avoidRepeating: [
        ...decision.responsePlan.avoidRepeating,
        'prices',
        'availability confirmations',
        'completed bookings',
      ],
    },
  };
}

/** Minimum fields to run a live search. */
export function canStartSearch(state: ConversationState): boolean {
  if (!state.origin?.value || !state.destination?.value) return false;
  const dep = state.departureDate?.value;
  if (!dep || dep.kind !== 'exact') return false;
  // Date is enough; services may be flights-only default at search time
  return !evaluateClarification(state).needed || Boolean(state.origin && state.destination && dep);
}

/**
 * Services to query: explicit services, else flights for a city route.
 * Never invent accommodation or car hire here.
 */
export function resolveSearchServices(state: ConversationState): TravelServiceKind[] {
  const services = [...state.services];
  if (
    state.origin?.value &&
    state.destination?.value &&
    !services.includes('flights') &&
    !state.excludedServices.includes('flights')
  ) {
    services.unshift('flights');
  }
  if (services.length === 0) return ['flights'];
  return Array.from(new Set(services));
}
