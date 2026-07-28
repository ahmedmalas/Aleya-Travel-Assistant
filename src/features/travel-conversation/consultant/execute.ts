import { assignRoles } from '../assign';
import { extractCandidates } from '../candidates';
import { evaluateClarification } from '../clarify';
import { mergeTravelState } from '../merge';
import type { ConversationState, TravelPatch, TravelServiceKind } from '../types';
import { createEmptyConversationState } from '../types';
import { getSearchSession } from './memory';
import {
  endSearchSession,
  refineSearchSession,
  selectResult,
  startSearchSession,
} from './session';
import type {
  ActionObservation,
  ConsultantContext,
  ConsultantTurnDecision,
} from './types';
import { canStartSearch, resolveSearchServices } from './validate';

function cloneState(state: ConversationState): ConversationState {
  return {
    ...state,
    services: [...state.services],
    excludedServices: [...state.excludedServices],
    preferences: [...state.preferences],
    changeHistory: [...state.changeHistory],
    lastChangedFields: [...state.lastChangedFields],
  };
}

/**
 * Execute validated actions only. Generated prose never mutates state.
 */
export function executeConsultantDecision(input: {
  ctx: ConsultantContext;
  decision: ConsultantTurnDecision;
  now: Date;
}): ActionObservation {
  const stateBefore = cloneState(input.ctx.trip);
  let state = cloneState(input.ctx.trip);
  const servicesAdded: TravelServiceKind[] = [];
  const servicesRemoved: TravelServiceKind[] = [];
  let activateSearch = false;
  let continueSearch = false;
  let servicesToSearch: TravelServiceKind[] = [];
  let searchSession = getSearchSession();
  let selectedResult = undefined;
  const providerActions: Array<{ kind: string; detail: string }> = [];

  for (const action of input.decision.actionSequence) {
    if (action.type === 'end_search_session') {
      endSearchSession();
      searchSession = null;
      providerActions.push({ kind: 'end_search_session', detail: 'ended previous search' });
    }

    if (action.type === 'clear_trip') {
      endSearchSession();
      searchSession = null;
      state = createEmptyConversationState();
      providerActions.push({ kind: 'clear_trip', detail: 'fresh canonical trip' });
    }

    if (action.type === 'apply_extract_merge') {
      const pending = state.pendingClarification;
      const text = input.ctx.normalizedMessage.replace(
        /^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.]?\s+/i,
        '',
      );
      const candidates = extractCandidates(text, input.now, state);
      const patch = assignRoles(candidates, state, pending);
      state = mergeTravelState(state, patch, input.now, text);
      const clarification = evaluateClarification(state);
      state = {
        ...state,
        pendingClarification: clarification.needed ? clarification.field : undefined,
        phase:
          clarification.needed || !state.destination
            ? 'requirements'
            : state.phase === 'locked'
              ? 'locked'
              : 'ready',
      };
      providerActions.push({
        kind: 'extract_merge',
        detail: `changed: ${state.lastChangedFields.join(',') || 'none'}`,
      });
    }

    if (action.type === 'add_service') {
      if (!state.services.includes(action.service)) {
        const patch: TravelPatch = {
          servicesAdd: [action.service],
          explicitChanges: ['services'],
          clearFields: [],
        };
        state = mergeTravelState(state, patch, input.now, input.ctx.normalizedMessage);
        servicesAdded.push(action.service);
        providerActions.push({ kind: 'add_service', detail: action.service });
      }
    }

    if (action.type === 'remove_service') {
      const patch: TravelPatch = {
        servicesRemove: [action.service],
        explicitChanges: ['services'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.now, input.ctx.normalizedMessage);
      servicesRemoved.push(action.service);
      providerActions.push({ kind: 'remove_service', detail: action.service });
    }

    if (action.type === 'set_travellers') {
      const patch: TravelPatch = {
        travellers: { value: action.count, source: 'explicit', confirmed: true },
        explicitChanges: ['travellers'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.now, input.ctx.normalizedMessage);
      providerActions.push({ kind: 'set_travellers', detail: String(action.count) });
    }

    if (action.type === 'set_duration_nights') {
      const patch: TravelPatch = {
        durationNights: { value: action.nights, source: 'explicit', confirmed: true },
        explicitChanges: ['durationNights'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.now, input.ctx.normalizedMessage);
      providerActions.push({ kind: 'set_duration', detail: String(action.nights) });
    }

    if (action.type === 'set_accommodation_area') {
      const patch: TravelPatch = {
        accommodationArea: { value: action.area, source: 'explicit', confirmed: true },
        servicesAdd: ['accommodation'],
        explicitChanges: ['accommodationArea'],
        clearFields: [],
      };
      state = mergeTravelState(state, patch, input.now, input.ctx.normalizedMessage);
      if (!servicesAdded.includes('accommodation')) servicesAdded.push('accommodation');
      providerActions.push({ kind: 'set_area', detail: action.area });
    }

    if (action.type === 'set_offer') {
      state = {
        ...state,
        lastOffer:
          action.offer === 'start_search'
            ? { kind: 'start_search', atTurn: state.turnCount }
            : undefined,
      };
    }

    if (action.type === 'start_search') {
      if (!canStartSearch(state)) {
        providerActions.push({
          kind: 'start_search_blocked',
          detail: 'missing origin, destination, or exact date',
        });
        continue;
      }
      // Ensure flights for city routes without inventing hotel/car
      const services = resolveSearchServices(state);
      // Persist flights if we add them for search
      if (services.includes('flights') && !state.services.includes('flights')) {
        state = mergeTravelState(
          state,
          {
            servicesAdd: ['flights'],
            explicitChanges: ['services'],
            clearFields: [],
          },
          input.now,
          input.ctx.normalizedMessage,
        );
        if (!servicesAdded.includes('flights')) servicesAdded.push('flights');
      }
      searchSession = startSearchSession(state, services);
      activateSearch = true;
      servicesToSearch = services;
      state = { ...state, lastOffer: undefined, phase: 'ready' };
      providerActions.push({
        kind: 'start_search',
        detail: `providers: ${services.join(',')}`,
      });
    }

    if (action.type === 'refine_search') {
      searchSession = refineSearchSession(state, action.services, action.filters);
      continueSearch = true;
      servicesToSearch = action.services;
      providerActions.push({
        kind: 'refine_search',
        detail: `${action.services.join(',')}:${JSON.stringify(action.filters)}`,
      });
    }

    if (action.type === 'select_result') {
      selectedResult = selectResult(action.service, action.ordinal);
      searchSession = getSearchSession();
      providerActions.push({
        kind: 'select_result',
        detail: `${action.service}#${action.ordinal}`,
      });
    }
  }

  // Post-merge clarification marker
  const missing = evaluateClarification(state);
  if (missing.needed) {
    state = {
      ...state,
      pendingClarification: missing.field,
      phase: 'requirements',
    };
  } else if (state.destination && state.origin && state.departureDate) {
    state = { ...state, phase: state.phase === 'locked' ? 'locked' : 'ready' };
  }

  // Derive service deltas from before/after so extract-merge adds are visible to NLG
  const derivedAdded = state.services.filter((s) => !stateBefore.services.includes(s));
  const derivedRemoved = stateBefore.services.filter((s) => !state.services.includes(s));
  for (const s of derivedAdded) {
    if (!servicesAdded.includes(s)) servicesAdded.push(s);
  }
  for (const s of derivedRemoved) {
    if (!servicesRemoved.includes(s)) servicesRemoved.push(s);
  }

  return {
    stateBefore,
    stateAfter: state,
    servicesAdded,
    servicesRemoved,
    activateSearch,
    continueSearch,
    servicesToSearch,
    searchSession,
    selectedResult,
    inventedNothing: true,
    providerActions,
  };
}
