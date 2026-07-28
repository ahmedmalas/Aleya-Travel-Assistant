/**
 * Stages 8–9 — Execute authorised actions and observe provider results.
 */

import {
  attachDiscoveryQuestion,
  attachRecommendations,
  resolveSelectedDestination,
} from '../destination-discovery';
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
    discovery: state.discovery
      ? {
          ...state.discovery,
          criteria: {
            ...state.discovery.criteria,
            climate: [...state.discovery.criteria.climate],
            characters: [...state.discovery.criteria.characters],
            activities: [...state.discovery.criteria.activities],
            exclusions: [...state.discovery.criteria.exclusions],
          },
          recommendations: [...state.discovery.recommendations],
          rejectedIds: [...state.discovery.rejectedIds],
          lastRecommendedIds: [...state.discovery.lastRecommendedIds],
        }
      : undefined,
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

    if (action.type === 'collect_discovery_criteria') {
      results.push({
        type: 'collect_discovery_criteria',
        detail: state.discovery?.criteria.characters.join(',') || 'ok',
        ok: true,
      });
    }

    if (action.type === 'ask_discovery_question') {
      state = attachDiscoveryQuestion(state);
      if (state.discovery?.pendingQuestionId) {
        state = {
          ...state,
          discovery: {
            ...state.discovery,
            pendingQuestionId: action.questionId as typeof state.discovery.pendingQuestionId,
            lastQuestionId: action.questionId as typeof state.discovery.lastQuestionId,
            lastAction: 'ask_discovery_question',
          },
        };
      }
      results.push({
        type: 'ask_discovery_question',
        detail: action.questionId,
        ok: true,
      });
    }

    if (action.type === 'recommend_destinations') {
      state = attachRecommendations(state, false);
      results.push({
        type: 'recommend_destinations',
        detail: state.discovery?.recommendations.map((r) => r.placeName).join(',') || 'none',
        ok: (state.discovery?.recommendations.length ?? 0) > 0,
      });
    }

    if (action.type === 'refine_destination_recommendations') {
      state = attachRecommendations(state, true);
      results.push({
        type: 'refine_destination_recommendations',
        detail: state.discovery?.recommendations.map((r) => r.placeName).join(',') || 'none',
        ok: true,
      });
    }

    if (action.type === 'resolve_selected_destination') {
      state = resolveSelectedDestination(state, {
        placeName: action.placeName,
        candidateId: action.candidateId,
      });
      results.push({
        type: 'resolve_selected_destination',
        detail: state.destination?.value ?? action.placeName,
        ok: Boolean(state.destination?.value),
      });
    }

    if (action.type === 'transition_to_booking') {
      if (state.discovery && state.discovery.mode !== 'completed') {
        state = {
          ...state,
          discovery: {
            ...state.discovery,
            mode: 'completed',
            lastAction: 'transition_to_booking',
          },
        };
      }
      results.push({ type: 'transition_to_booking', detail: 'booking', ok: true });
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
