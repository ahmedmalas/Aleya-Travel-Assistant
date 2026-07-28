import {
  resolveSync,
  toStoredTravelLocation,
} from '../../travel-location-intelligence';
import type { ConversationState } from '../types';
import {
  criteriaChanged,
  extractDiscoveryCriteriaDelta,
  mergeDiscoveryCriteria,
  resolveExclusionIds,
} from './criteriaExtract';
import {
  isEmptyAcknowledgement,
  matchRejectedRecommendation,
  matchSelectionFromMessage,
} from './intent';
import { rankDiscoveryCandidates, shouldRecommend } from './rank';
import { pickDiscoveryQuestion } from './questions';
import type { DestinationDiscoveryState } from './types';
import { createActiveDiscoveryState, emptyDiscoveryCriteria } from './types';

export type DiscoveryApplyResult = {
  state: ConversationState;
  discoveryChanged: boolean;
  selection?: { placeName: string; candidateId?: string };
  rejectedIdsAdded: string[];
};

function cloneDiscovery(d: DestinationDiscoveryState): DestinationDiscoveryState {
  return {
    ...d,
    criteria: {
      ...d.criteria,
      climate: [...d.criteria.climate],
      characters: [...d.criteria.characters],
      activities: [...d.criteria.activities],
      exclusions: [...d.criteria.exclusions],
    },
    recommendations: d.recommendations.map((r) => ({
      ...r,
      reasons: [...r.reasons],
      tradeoffs: [...r.tradeoffs],
    })),
    rejectedIds: [...d.rejectedIds],
    lastRecommendedIds: [...d.lastRecommendedIds],
  };
}

/** Merge discovery criteria into state without a second turnCount increment. */
export function applyDiscoveryTurn(input: {
  state: ConversationState;
  message: string;
  activate: boolean;
}): DiscoveryApplyResult {
  let state = input.state;
  const text = input.message;
  const rejectedIdsAdded: string[] = [];

  if (!input.activate && state.discovery?.mode !== 'active') {
    return { state, discoveryChanged: false, rejectedIdsAdded };
  }

  if (isEmptyAcknowledgement(text) && state.discovery?.mode === 'active') {
    return { state, discoveryChanged: false, rejectedIdsAdded };
  }

  const selection = matchSelectionFromMessage(text, state.discovery);
  if (selection) {
    return {
      state,
      discoveryChanged: false,
      selection,
      rejectedIdsAdded,
    };
  }

  let discovery = state.discovery?.mode === 'active'
    ? cloneDiscovery(state.discovery)
    : createActiveDiscoveryState(emptyDiscoveryCriteria());

  const before = cloneDiscovery(discovery).criteria;
  const delta = extractDiscoveryCriteriaDelta(text);
  discovery.criteria = mergeDiscoveryCriteria(discovery.criteria, delta);

  const rejectAll = matchRejectedRecommendation(text, discovery);
  if (rejectAll.length) {
    discovery.rejectedIds = Array.from(new Set([...discovery.rejectedIds, ...rejectAll]));
    rejectedIdsAdded.push(...rejectAll);
    discovery.recommendations = [];
    discovery.lastRecommendedIds = [];
  }

  const exclusionIds = resolveExclusionIds(discovery.criteria.exclusions);
  if (exclusionIds.length) {
    for (const id of exclusionIds) {
      if (!discovery.rejectedIds.includes(id)) {
        discovery.rejectedIds.push(id);
        rejectedIdsAdded.push(id);
      }
    }
  }

  // Sync booking origin when discovery captures an origin (helps transition)
  const changed = criteriaChanged(before, discovery.criteria) || rejectedIdsAdded.length > 0;
  discovery.mode = 'active';
  discovery.lastAction = changed ? 'collect_discovery_criteria' : discovery.lastAction;

  state = {
    ...state,
    discovery,
    lastChangedFields: changed
      ? Array.from(new Set([...state.lastChangedFields, 'discovery']))
      : state.lastChangedFields,
  };

  // Mirror origin onto booking state when discovery provides it and booking origin empty
  if (discovery.criteria.originLabel && !state.origin?.value) {
    const { best, candidates } = resolveSync(discovery.criteria.originLabel, {
      allowFuzzy: true,
      roleHint: 'origin',
    });
    const place = best ?? candidates[0]?.place;
    state = {
      ...state,
      origin: {
        value: discovery.criteria.originLabel,
        source: 'explicit',
        confirmed: true,
      },
      originPlace: place ? toStoredTravelLocation(place) : undefined,
      lastChangedFields: Array.from(new Set([...state.lastChangedFields, 'origin', 'discovery'])),
    };
  }

  // Mirror nights / travellers into booking fields when present
  if (discovery.criteria.durationNights != null && !state.durationNights?.value) {
    state = {
      ...state,
      durationNights: {
        value: discovery.criteria.durationNights,
        source: 'explicit',
        confirmed: true,
      },
      lastChangedFields: Array.from(
        new Set([...state.lastChangedFields, 'durationNights', 'discovery']),
      ),
    };
  }
  if (discovery.criteria.travellers != null && !state.travellers?.value) {
    state = {
      ...state,
      travellers: {
        value: discovery.criteria.travellers,
        source: 'explicit',
        confirmed: true,
      },
      lastChangedFields: Array.from(new Set([...state.lastChangedFields, 'travellers', 'discovery'])),
    };
  } else if (discovery.criteria.travellerGroup === 'couple' && !state.travellers?.value) {
    state = {
      ...state,
      travellers: { value: 2, source: 'inferred', confirmed: false },
      lastChangedFields: Array.from(new Set([...state.lastChangedFields, 'travellers', 'discovery'])),
    };
  }

  // Preference strings for later booking (non-destructive)
  const prefAdds: string[] = [];
  for (const c of discovery.criteria.characters) prefAdds.push(c);
  if (discovery.criteria.vibe) prefAdds.push(discovery.criteria.vibe);
  if (discovery.criteria.budgetLevel) prefAdds.push(discovery.criteria.budgetLevel);
  if (prefAdds.length) {
    state = {
      ...state,
      preferences: Array.from(new Set([...state.preferences, ...prefAdds])),
    };
  }

  void shouldRecommend;
  void pickDiscoveryQuestion;
  void rankDiscoveryCandidates;

  return {
    state,
    discoveryChanged: changed || Boolean(state.lastChangedFields.includes('discovery')),
    rejectedIdsAdded,
  };
}

export function attachRecommendations(
  state: ConversationState,
  refine: boolean,
): ConversationState {
  const discovery = state.discovery;
  if (!discovery || discovery.mode !== 'active') return state;
  const ranked = rankDiscoveryCandidates(discovery.criteria, discovery.rejectedIds, 3);
  const next: DestinationDiscoveryState = {
    ...discovery,
    recommendations: ranked,
    lastRecommendedIds: ranked.map((r) => r.id),
    lastAction: refine ? 'refine_destination_recommendations' : 'recommend_destinations',
    pendingQuestionId: undefined,
  };
  return {
    ...state,
    discovery: next,
    lastChangedFields: Array.from(new Set([...state.lastChangedFields, 'discovery'])),
  };
}

export function attachDiscoveryQuestion(
  state: ConversationState,
): ConversationState {
  const discovery = state.discovery;
  if (!discovery || discovery.mode !== 'active') return state;
  const q = pickDiscoveryQuestion(discovery.criteria, discovery.lastQuestionId);
  if (!q) return state;
  return {
    ...state,
    discovery: {
      ...discovery,
      pendingQuestionId: q.id,
      lastQuestionId: q.id,
      lastAction: 'ask_discovery_question',
    },
    lastChangedFields: Array.from(new Set([...state.lastChangedFields, 'discovery'])),
  };
}

export function resolveSelectedDestination(
  state: ConversationState,
  selection: { placeName: string; candidateId?: string },
): ConversationState {
  const { best, candidates } = resolveSync(selection.placeName, {
    allowFuzzy: true,
    roleHint: 'destination',
  });
  const place = best ?? candidates[0]?.place;
  const label = place?.canonicalName ?? selection.placeName;
  const discovery = state.discovery
    ? {
        ...state.discovery,
        mode: 'selected' as const,
        selectedId: selection.candidateId,
        selectedPlaceName: label,
        lastAction: 'resolve_selected_destination',
        recommendations: [],
      }
    : undefined;

  const prefAdds = discovery
    ? [
        ...discovery.criteria.characters,
        ...(discovery.criteria.vibe ? [discovery.criteria.vibe] : []),
        ...(discovery.criteria.budgetLevel ? [discovery.criteria.budgetLevel] : []),
      ]
    : [];

  return {
    ...state,
    destination: { value: label, source: 'explicit', confirmed: true },
    destinationPlace: place ? toStoredTravelLocation(place) : { displayName: label, canonicalName: label, type: 'unknown' },
    discovery: discovery
      ? { ...discovery, mode: 'completed', lastAction: 'transition_to_booking' }
      : undefined,
    preferences: Array.from(new Set([...state.preferences, ...prefAdds])),
    lastChangedFields: Array.from(
      new Set([...state.lastChangedFields, 'destination', 'discovery']),
    ),
  };
}
