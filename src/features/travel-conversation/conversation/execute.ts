/**
 * Stages 8–9 — Execute authorised actions and observe provider results.
 */

import type { ConversationState, TravelPatch } from '../types';
import { mergeTravelState } from '../merge';
import type {
  ExecutedResult,
  PlannedAction,
  ProviderObservation,
  TripCompleteness,
} from './contracts';
import {
  endSearchSession,
  refineSearchSession,
  resolveSearchServices,
  startSearchSession,
} from './providers';
import { setSearchOffered } from './runtime';

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

export function executeActions(input: {
  state: ConversationState;
  plan: PlannedAction[];
  completeness: TripCompleteness;
  now: Date;
  message: string;
}): {
  state: ConversationState;
  results: ExecutedResult[];
  provider: ProviderObservation;
} {
  let state = clone(input.state);
  const results: ExecutedResult[] = [];
  const provider: ProviderObservation = {
    activateSearch: false,
    continueSearch: false,
    servicesToSearch: [],
  };

  for (const action of input.plan) {
    if (action.type === 'end_search_session') {
      endSearchSession();
      results.push({ type: 'end_search_session', detail: 'ended', ok: true });
    }

    if (action.type === 'start_search') {
      if (input.completeness.readyToSearch) {
        let services = resolveSearchServices(state);
        if (!state.services.includes('flights') && !state.excludedServices.includes('flights')) {
          const patch: TravelPatch = {
            servicesAdd: ['flights'],
            explicitChanges: ['services'],
            clearFields: [],
          };
          state = mergeTravelState(state, patch, input.now, input.message);
          services = resolveSearchServices(state);
        }
        startSearchSession(state, services);
        setSearchOffered(false);
        provider.activateSearch = true;
        provider.servicesToSearch = services;
        provider.resultsSummary = `started ${services.join(',')}`;
        results.push({ type: 'start_search', detail: services.join(','), ok: true });
      } else {
        results.push({
          type: 'start_search',
          detail: 'blocked — missing search requirements',
          ok: false,
        });
      }
    }

    if (action.type === 'refine_search') {
      refineSearchSession(state, action.services, action.filters);
      setSearchOffered(false);
      provider.continueSearch = true;
      provider.servicesToSearch = action.services;
      provider.resultsSummary = `refined ${action.services.join(',')}`;
      results.push({
        type: 'refine_search',
        detail: `${action.services.join(',')}:${JSON.stringify(action.filters)}`,
        ok: true,
      });
    }
  }

  return { state, results, provider };
}
