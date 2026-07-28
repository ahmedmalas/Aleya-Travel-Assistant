import { assignRoles } from '../assign';
import { extractCandidates } from '../candidates';
import { evaluateClarification } from '../clarify';
import { mergeTravelState } from '../merge';
import type { ConversationState, TravelPatch, TravelServiceKind } from '../types';
import { createEmptyConversationState } from '../types';
import {
  endSearchSession,
  refineSearchSession,
  selectResult,
  startSearchSession,
} from './searchMemory';
import type {
  ActionExecutionResult,
  ConversationContext,
  DialogueDecision,
} from './types';

function requirementsReady(state: ConversationState): boolean {
  return Boolean(state.destination) && !evaluateClarification(state).needed;
}

/**
 * Execute validated state/search actions. Generated prose never mutates state.
 */
export function executeDecision(input: {
  ctx: ConversationContext;
  decision: DialogueDecision;
  now: Date;
}): ActionExecutionResult {
  let state = input.ctx.trip;
  let patch: TravelPatch = {
    explicitChanges: [],
    clearFields: [],
  };
  let activateSearch = false;
  let continueSearch = false;
  let servicesToSearch: TravelServiceKind[] = [];
  let searchSession = input.ctx.searchSession;

  for (const action of input.decision.stateActions) {
    if (action.type === 'clear_trip') {
      endSearchSession();
      searchSession = null;
      state = createEmptyConversationState();
      patch = { explicitChanges: [], clearFields: [] };
      continue;
    }

    if (action.type === 'apply_extract_merge') {
      const pending = state.pendingClarification;
      const text = input.ctx.normalizedMessage.replace(
        /^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.]?\s+/i,
        '',
      );
      const candidates = extractCandidates(text, input.now, state);
      patch = assignRoles(candidates, state, pending);
      state = mergeTravelState(state, patch, input.now, text);
      const clarification = evaluateClarification(state);
      state = {
        ...state,
        pendingClarification: clarification.needed ? clarification.field : undefined,
        phase: clarification.needed || !requirementsReady(state)
          ? 'requirements'
          : state.phase === 'locked'
            ? 'locked'
            : 'ready',
      };
    }

    if (action.type === 'set_travellers') {
      const travPatch: TravelPatch = {
        travellers: { value: action.count, source: 'explicit', confirmed: true },
        explicitChanges: ['travellers'],
        clearFields: [],
      };
      state = mergeTravelState(state, travPatch, input.now, input.ctx.normalizedMessage);
      patch = { ...patch, ...travPatch, explicitChanges: [...patch.explicitChanges, 'travellers'] };
    }

    if (action.type === 'set_accommodation_area') {
      const areaPatch: TravelPatch = {
        accommodationArea: { value: action.area, source: 'explicit', confirmed: true },
        servicesAdd: ['accommodation'],
        explicitChanges: ['accommodationArea'],
        clearFields: [],
      };
      state = mergeTravelState(state, areaPatch, input.now, input.ctx.normalizedMessage);
    }

    if (action.type === 'set_preference') {
      const prefPatch: TravelPatch = {
        preferencesAdd: [action.value],
        explicitChanges: [],
        clearFields: [],
      };
      state = mergeTravelState(state, prefPatch, input.now, input.ctx.normalizedMessage);
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
  }

  let selectedResult = undefined;

  for (const action of input.decision.searchActions) {
    if (action.type === 'end_session') {
      endSearchSession();
      searchSession = null;
    }
    if (action.type === 'start') {
      searchSession = startSearchSession(state, action.services);
      activateSearch = true;
      servicesToSearch = action.services;
      state = { ...state, lastOffer: undefined, phase: state.phase === 'locked' ? 'locked' : 'ready' };
    }
    if (action.type === 'refine') {
      searchSession = refineSearchSession(state, action.services, action.filters);
      continueSearch = true;
      servicesToSearch = action.services;
    }
    if (action.type === 'refresh') {
      searchSession = refineSearchSession(state, action.services, searchSession?.filters ?? {});
      continueSearch = true;
      servicesToSearch = action.services;
    }
    if (action.type === 'focus' && searchSession) {
      searchSession = { ...searchSession, focusService: action.service };
      continueSearch = true;
      servicesToSearch = [action.service];
    }
  }

  for (const ref of input.decision.resultReferences) {
    if (ref.ordinal && ref.service) {
      selectedResult = selectResult(ref.service, ref.ordinal);
      searchSession = selectedResult
        ? {
            ...(searchSession ?? input.ctx.searchSession)!,
            selected: {
              service: ref.service,
              id: selectedResult.id,
              label: selectedResult.label,
            },
          }
        : searchSession;
    }
  }

  // If we offered search and requirements are ready after merge, ensure offer is set
  if (
    input.decision.stateActions.some((a) => a.type === 'set_offer' && a.offer === 'start_search') &&
    requirementsReady(state) &&
    !activateSearch
  ) {
    state = {
      ...state,
      lastOffer: { kind: 'start_search', atTurn: state.turnCount },
      phase: 'ready',
    };
  }

  // Fill clarification after merge when capture path still missing something
  if (!activateSearch && !continueSearch) {
    const missing = evaluateClarification(state);
    if (missing.needed && missing.question && !input.decision.clarification) {
      // orchestrate will merge into response plan
      state = {
        ...state,
        pendingClarification: missing.field,
        phase: 'requirements',
      };
    }
  }

  return {
    state,
    patch,
    searchSession,
    activateSearch,
    continueSearch,
    servicesToSearch,
    selectedResult,
    inventedNothing: true,
  };
}
