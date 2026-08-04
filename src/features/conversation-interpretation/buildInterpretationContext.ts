import type { ConversationCoreState, ConversationTranscriptEntry } from '../conversation-core';
import type { ActiveTravelRequirement } from './types';

export type InterpretationTravelSnapshot = {
  destination: string | null;
  origin: string | null;
  departureDate: string | null;
  returnDate: string | null;
  adultCount: number | null;
  childCount: number | null;
  infantCount: number | null;
  flightsRequested: boolean | null;
  accommodationRequested: boolean | null;
  carHireRequested: boolean | null;
  activitiesRequested: boolean | null;
  restaurantsRequested: boolean | null;
  restaurantPreference: string | null;
  conversationComplete: boolean | null;
  searchExecutionRequested: boolean | null;
  amendmentResumeSearchReady: boolean | null;
  destinationResolutionStatus:
    | 'resolved'
    | 'unresolved'
    | 'ambiguous'
    | null;
  originResolutionStatus: 'resolved' | 'unresolved' | 'ambiguous' | null;
};

export type InterpretationHistoryTurn = {
  role: 'user' | 'assistant';
  message: string;
  timestamp?: string;
};

/**
 * Complete relevant context for semantic interpretation.
 * Authoritative package shared by AI prompt, API payload, and offline adapters.
 */
export type TravelInterpretationContext = {
  message: string;
  activeRequirement: ActiveTravelRequirement;
  activeRequirementMeaning: string;
  todayIso: string;
  travelState: InterpretationTravelSnapshot;
  /** Explicit temporal anchors the model must use for relative references. */
  temporalAnchors: {
    departureDate: string | null;
    returnDate: string | null;
    primaryAnchorDate: string | null;
    primaryAnchorRole: 'departureDate' | 'returnDate' | 'today' | 'none';
  };
  recentHistory: InterpretationHistoryTurn[];
  lastAssistantMessage: string | null;
  lastUserMessageBeforeCurrent: string | null;
};

const REQUIREMENT_MEANING: Record<ActiveTravelRequirement, string> = {
  destination: 'Traveller still needs a destination.',
  origin: 'Traveller still needs an origin / departure city.',
  departureDate: 'Traveller still needs a departure date.',
  returnDate: 'Traveller still needs a return date.',
  adultCount:
    'Traveller still needs adult/guest count. Self-party language (myself / just me / alone) means 1 adult. Bare cardinals fill this slot.',
  childCount:
    'Traveller still needs child count. Zero-quantity language (none / no / zero) means 0 children for this active slot — not conversation completion.',
  infantCount:
    'Traveller still needs infant count. Zero-quantity language (none / no / zero) means 0 infants for this active slot — not conversation completion.',
  services: 'Traveller still needs which services to search (flights, hotel, car).',
  none: 'Core trip slots are filled; interpret corrections, amendments (reopen/replace fields or add/remove services), extras, conversation-complete, or confirm-to-search signals.',
};

function snapshotTravelState(state: ConversationCoreState): InterpretationTravelSnapshot {
  return {
    destination: state.destination,
    origin: state.origin,
    departureDate: state.departureDate,
    returnDate: state.returnDate,
    adultCount: state.adultCount,
    childCount: state.childCount,
    infantCount: state.infantCount,
    flightsRequested: state.flightsRequested,
    accommodationRequested: state.accommodationRequested,
    carHireRequested: state.carHireRequested,
    activitiesRequested: state.activitiesRequested,
    restaurantsRequested: state.restaurantsRequested,
    restaurantPreference: state.restaurantPreference,
    conversationComplete: state.conversationComplete,
    searchExecutionRequested: state.searchExecutionRequested,
    amendmentResumeSearchReady: state.amendmentResumeSearchReady,
    destinationResolutionStatus: state.destinationResolutionStatus,
    originResolutionStatus: state.originResolutionStatus,
  };
}

function toHistoryTurns(
  history: ConversationTranscriptEntry[] | undefined,
  limit = 16,
): InterpretationHistoryTurn[] {
  if (!history || history.length === 0) return [];
  return history.slice(-limit).map((entry) => ({
    role: entry.role === 'assistant' ? 'assistant' : 'user',
    message: entry.message,
    timestamp: entry.timestamp,
  }));
}

function pickPrimaryAnchor(
  activeRequirement: ActiveTravelRequirement,
  state: InterpretationTravelSnapshot,
  todayIso: string,
): TravelInterpretationContext['temporalAnchors'] {
  if (activeRequirement === 'returnDate' && state.departureDate) {
    return {
      departureDate: state.departureDate,
      returnDate: state.returnDate,
      primaryAnchorDate: state.departureDate,
      primaryAnchorRole: 'departureDate',
    };
  }
  if (activeRequirement === 'departureDate' && state.returnDate) {
    return {
      departureDate: state.departureDate,
      returnDate: state.returnDate,
      primaryAnchorDate: state.returnDate,
      primaryAnchorRole: 'returnDate',
    };
  }
  if (state.departureDate) {
    return {
      departureDate: state.departureDate,
      returnDate: state.returnDate,
      primaryAnchorDate: state.departureDate,
      primaryAnchorRole: 'departureDate',
    };
  }
  if (state.returnDate) {
    return {
      departureDate: state.departureDate,
      returnDate: state.returnDate,
      primaryAnchorDate: state.returnDate,
      primaryAnchorRole: 'returnDate',
    };
  }
  return {
    departureDate: state.departureDate,
    returnDate: state.returnDate,
    primaryAnchorDate: todayIso,
    primaryAnchorRole: 'today',
  };
}

/**
 * Build the complete interpretation context for one user turn.
 */
export function buildInterpretationContext(input: {
  message: string;
  currentState: ConversationCoreState;
  activeRequirement: ActiveTravelRequirement;
  recentHistory?: ConversationTranscriptEntry[];
  now?: Date;
}): TravelInterpretationContext {
  const now = input.now ?? new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const travelState = snapshotTravelState(input.currentState);
  const recentHistory = toHistoryTurns(
    input.recentHistory ?? input.currentState.transcript,
  );
  const lastAssistantMessage =
    [...recentHistory].reverse().find((turn) => turn.role === 'assistant')
      ?.message ?? null;
  const lastUserMessageBeforeCurrent =
    [...recentHistory].reverse().find((turn) => turn.role === 'user')?.message ??
    null;

  return {
    message: input.message,
    activeRequirement: input.activeRequirement,
    activeRequirementMeaning: REQUIREMENT_MEANING[input.activeRequirement],
    todayIso,
    travelState,
    temporalAnchors: pickPrimaryAnchor(
      input.activeRequirement,
      travelState,
      todayIso,
    ),
    recentHistory,
    lastAssistantMessage,
    lastUserMessageBeforeCurrent,
  };
}

export function travelStateForApi(
  state: ConversationCoreState,
): InterpretationTravelSnapshot {
  return snapshotTravelState(state);
}
