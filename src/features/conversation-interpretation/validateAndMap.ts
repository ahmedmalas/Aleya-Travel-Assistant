import type {
  ConversationCoreState,
  ConversationStateUpdate,
  ConversationTripLeg,
} from '../conversation-core';
import { isShapeValidPlaceName } from './placeResolution';
import type { TravelSemanticInterpretation } from './schema';
import { buildTripLegsFromStops } from './tripStructureSemantics';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function addDaysIso(isoDate: string, days: number): string | null {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function pickMerged<T>(
  update: ConversationStateUpdate,
  key: keyof ConversationStateUpdate,
  current: ConversationCoreState,
): T {
  if (Object.prototype.hasOwnProperty.call(update, key)) {
    return update[key] as T;
  }
  return current[key as keyof ConversationCoreState] as T;
}

/**
 * Search-ready eligibility after an amendment: core places/dates present and
 * required passenger counts filled when flights or accommodation are requested.
 */
function isSearchReadyEligible(snapshot: {
  destination: string | null;
  origin: string | null;
  departureDate: string | null;
  returnDate: string | null;
  tripStructure: ConversationCoreState['tripStructure'];
  destinationStops: string[] | null;
  flightsRequested: boolean | null;
  accommodationRequested: boolean | null;
  adultCount: number | null;
  childCount: number | null;
  infantCount: number | null;
}): boolean {
  if (snapshot.origin === null || snapshot.departureDate === null) {
    return false;
  }
  if (snapshot.tripStructure === 'multi_city') {
    if (
      snapshot.destinationStops === null ||
      snapshot.destinationStops.length < 2
    ) {
      return false;
    }
  } else if (snapshot.destination === null) {
    return false;
  }

  // Return date required for classic return trips only.
  if (
    snapshot.tripStructure !== 'one_way' &&
    snapshot.tripStructure !== 'multi_city' &&
    snapshot.returnDate === null
  ) {
    return false;
  }

  const passengerRelevant =
    snapshot.flightsRequested === true ||
    snapshot.accommodationRequested === true;
  if (!passengerRelevant) return true;
  return (
    snapshot.adultCount !== null &&
    snapshot.childCount !== null &&
    snapshot.infantCount !== null
  );
}

/**
 * Deterministic validation + mapping from semantic interpretation → stateUpdate.
 * AI never writes canonical state directly.
 *
 * Shape-valid places are accepted even when TLI could not resolve them.
 * "Unknown to TLI" is not treated as "not a place."
 */
export function validateAndMapSemanticInterpretation(
  semantic: TravelSemanticInterpretation,
  currentState: ConversationCoreState,
): { stateUpdate: ConversationStateUpdate; warnings: string[] } {
  const warnings: string[] = [];
  const stateUpdate: ConversationStateUpdate = {};

  if (semantic.confidence < 0.35 && semantic.intent === 'unknown') {
    return { stateUpdate: {}, warnings: ['Low-confidence unknown intent rejected'] };
  }

  if (semantic.tripStructure !== null) {
    stateUpdate.tripStructure = semantic.tripStructure;
  }

  const validatedStops: string[] = [];
  for (const stop of semantic.destinationStops) {
    if (isShapeValidPlaceName(stop)) {
      validatedStops.push(stop);
    } else {
      warnings.push(`Invalid destination stop shape rejected: ${stop}`);
    }
  }
  if (validatedStops.length > 0) {
    stateUpdate.destinationStops = validatedStops;
    // Primary destination mirrors the first stop for single-destination callers.
    if (semantic.destination === null || semantic.destination === validatedStops[0]) {
      stateUpdate.destination = validatedStops[0] ?? null;
      stateUpdate.destinationResolutionStatus =
        semantic.destinationResolutionStatus ?? 'unresolved';
    }
    if (validatedStops.length >= 2) {
      stateUpdate.tripStructure = 'multi_city';
    }
  }

  if (semantic.destination !== null) {
    if (isShapeValidPlaceName(semantic.destination)) {
      stateUpdate.destination = semantic.destination;
      stateUpdate.destinationResolutionStatus =
        semantic.destinationResolutionStatus ?? 'unresolved';
      // Keep single destination mirrored into stops when stops were empty.
      if (validatedStops.length === 0) {
        stateUpdate.destinationStops = [semantic.destination];
      }
    } else {
      warnings.push(`Invalid destination shape rejected: ${semantic.destination}`);
    }
  }
  if (semantic.origin !== null) {
    if (isShapeValidPlaceName(semantic.origin)) {
      stateUpdate.origin = semantic.origin;
      stateUpdate.originResolutionStatus =
        semantic.originResolutionStatus ?? 'unresolved';
    } else {
      warnings.push(`Invalid origin shape rejected: ${semantic.origin}`);
    }
  }

  if (semantic.departureDate !== null) {
    if (isValidIsoDate(semantic.departureDate)) {
      stateUpdate.departureDate = semantic.departureDate;
    } else {
      warnings.push(`Invalid departureDate rejected: ${semantic.departureDate}`);
    }
  }

  if (semantic.returnDate !== null) {
    if (isValidIsoDate(semantic.returnDate)) {
      stateUpdate.returnDate = semantic.returnDate;
    } else {
      warnings.push(`Invalid returnDate rejected: ${semantic.returnDate}`);
    }
  }

  // Derive return from night count when departure is known (new or existing).
  if (
    stateUpdate.returnDate === undefined &&
    semantic.nightCount !== null &&
    semantic.nightCount > 0
  ) {
    const departure =
      stateUpdate.departureDate ?? currentState.departureDate ?? null;
    if (departure !== null) {
      const derived = addDaysIso(departure, semantic.nightCount);
      if (derived !== null) {
        stateUpdate.returnDate = derived;
      }
    } else {
      warnings.push('nightCount ignored until departureDate is known');
    }
  }

  // Conflict: return before departure → drop return.
  const dep = stateUpdate.departureDate ?? currentState.departureDate;
  const ret = stateUpdate.returnDate ?? currentState.returnDate;
  if (
    stateUpdate.returnDate !== undefined &&
    stateUpdate.returnDate !== null &&
    dep !== null &&
    stateUpdate.returnDate < dep
  ) {
    warnings.push('returnDate before departureDate rejected');
    delete stateUpdate.returnDate;
  }
  void ret;

  for (const [key, value] of [
    ['adultCount', semantic.adultCount],
    ['childCount', semantic.childCount],
    ['infantCount', semantic.infantCount],
  ] as const) {
    if (value !== null) {
      if (value > 20) {
        warnings.push(`${key} out of range rejected: ${value}`);
      } else {
        stateUpdate[key] = value;
      }
    }
  }

  if (semantic.flightsRequested !== null) {
    stateUpdate.flightsRequested = semantic.flightsRequested;
  }
  if (semantic.accommodationRequested !== null) {
    stateUpdate.accommodationRequested = semantic.accommodationRequested;
  }
  if (semantic.carHireRequested !== null) {
    stateUpdate.carHireRequested = semantic.carHireRequested;
  }
  if (semantic.activitiesRequested !== null) {
    stateUpdate.activitiesRequested = semantic.activitiesRequested;
  }
  if (semantic.restaurantsRequested !== null) {
    stateUpdate.restaurantsRequested = semantic.restaurantsRequested;
  }
  if (semantic.restaurantPreference !== null) {
    stateUpdate.restaurantPreference = semantic.restaurantPreference;
  }

  // Removals clear fields / set service flags false.
  for (const removal of semantic.removals) {
    switch (removal) {
      case 'destination':
        stateUpdate.destination = null;
        stateUpdate.destinationResolutionStatus = null;
        break;
      case 'origin':
        stateUpdate.origin = null;
        stateUpdate.originResolutionStatus = null;
        break;
      case 'departureDate':
        stateUpdate.departureDate = null;
        break;
      case 'returnDate':
        stateUpdate.returnDate = null;
        break;
      case 'flights':
        stateUpdate.flightsRequested = false;
        break;
      case 'accommodation':
        stateUpdate.accommodationRequested = false;
        break;
      case 'carHire':
        stateUpdate.carHireRequested = false;
        break;
      case 'activities':
        stateUpdate.activitiesRequested = false;
        break;
      case 'restaurants':
        stateUpdate.restaurantsRequested = false;
        break;
      default:
        break;
    }
  }

  // Amendment reopen: clear named slots after value writes so reopen wins
  // when both appear (reopen-only utterances have null values).
  for (const field of semantic.reopenFields) {
    switch (field) {
      case 'destination':
        stateUpdate.destination = null;
        stateUpdate.destinationResolutionStatus = null;
        break;
      case 'origin':
        stateUpdate.origin = null;
        stateUpdate.originResolutionStatus = null;
        break;
      case 'departureDate':
        stateUpdate.departureDate = null;
        break;
      case 'returnDate':
        stateUpdate.returnDate = null;
        break;
      case 'adultCount':
        stateUpdate.adultCount = null;
        break;
      case 'childCount':
        stateUpdate.childCount = null;
        break;
      case 'infantCount':
        stateUpdate.infantCount = null;
        break;
      default:
        break;
    }
  }

  const isAmendmentTurn =
    semantic.reopenFields.length > 0 ||
    semantic.amendmentResumeSearchReady === true;

  if (semantic.conversationComplete === true) {
    stateUpdate.conversationComplete = true;
  } else if (semantic.conversationComplete === false) {
    stateUpdate.conversationComplete = false;
  }

  if (semantic.searchExecutionRequested === true) {
    stateUpdate.searchExecutionRequested = true;
    // Search execution implies planning is complete.
    stateUpdate.conversationComplete = true;
  } else if (semantic.searchExecutionRequested === false) {
    stateUpdate.searchExecutionRequested = false;
  }

  if (semantic.amendmentResumeSearchReady === true) {
    stateUpdate.amendmentResumeSearchReady = true;
  } else if (semantic.amendmentResumeSearchReady === false) {
    stateUpdate.amendmentResumeSearchReady = false;
  }

  // Amendments always leave search-execution and, when slots reopen, leave
  // search-ready until the amendment is resolved.
  if (isAmendmentTurn || semantic.reopenFields.length > 0) {
    stateUpdate.searchExecutionRequested = false;
    if (semantic.reopenFields.length > 0) {
      stateUpdate.conversationComplete = false;
      stateUpdate.amendmentResumeSearchReady = true;
    }
  }

  // Origin must not equal destination when both set after merge.
  const nextDestination =
    stateUpdate.destination !== undefined
      ? stateUpdate.destination
      : currentState.destination;
  const nextOrigin =
    stateUpdate.origin !== undefined ? stateUpdate.origin : currentState.origin;
  if (
    nextDestination !== null &&
    nextOrigin !== null &&
    nextDestination === nextOrigin &&
    (stateUpdate.destination !== undefined || stateUpdate.origin !== undefined)
  ) {
    // Prefer keeping destination; clear origin update if it collides.
    if (stateUpdate.origin !== undefined && stateUpdate.origin === nextDestination) {
      warnings.push('origin equal to destination rejected');
      delete stateUpdate.origin;
      delete stateUpdate.originResolutionStatus;
    }
  }

  const mergedOrigin = pickMerged<string | null>(
    stateUpdate,
    'origin',
    currentState,
  );
  const mergedStops = pickMerged<string[] | null>(
    stateUpdate,
    'destinationStops',
    currentState,
  );
  const mergedDeparture = pickMerged<string | null>(
    stateUpdate,
    'departureDate',
    currentState,
  );
  const mergedStructure = pickMerged<ConversationCoreState['tripStructure']>(
    stateUpdate,
    'tripStructure',
    currentState,
  );

  // Rebuild ordered legs whenever origin/stops/departure participate in the update.
  if (
    stateUpdate.origin !== undefined ||
    stateUpdate.destinationStops !== undefined ||
    stateUpdate.departureDate !== undefined ||
    stateUpdate.tripStructure !== undefined
  ) {
    const stops = mergedStops ?? [];
    if (stops.length > 0) {
      const built = buildTripLegsFromStops({
        origin: mergedOrigin,
        destinationStops: stops,
        departureDate: mergedDeparture,
      });
      const legs: ConversationTripLeg[] = built.map((leg) => ({
        origin: leg.origin,
        destination: leg.destination,
        departureDate: leg.departureDate,
      }));
      stateUpdate.tripLegs = legs;
    }
  }

  const mergedForReady = {
    destination: pickMerged<string | null>(
      stateUpdate,
      'destination',
      currentState,
    ),
    origin: mergedOrigin,
    departureDate: mergedDeparture,
    returnDate: pickMerged<string | null>(
      stateUpdate,
      'returnDate',
      currentState,
    ),
    tripStructure: mergedStructure,
    destinationStops: mergedStops,
    flightsRequested: pickMerged<boolean | null>(
      stateUpdate,
      'flightsRequested',
      currentState,
    ),
    accommodationRequested: pickMerged<boolean | null>(
      stateUpdate,
      'accommodationRequested',
      currentState,
    ),
    adultCount: pickMerged<number | null>(
      stateUpdate,
      'adultCount',
      currentState,
    ),
    childCount: pickMerged<number | null>(
      stateUpdate,
      'childCount',
      currentState,
    ),
    infantCount: pickMerged<number | null>(
      stateUpdate,
      'infantCount',
      currentState,
    ),
  };

  const resumePending =
    pickMerged<boolean | null>(
      stateUpdate,
      'amendmentResumeSearchReady',
      currentState,
    ) === true;

  // Restore search-ready once the amendment leaves the trip complete again.
  if (resumePending && isSearchReadyEligible(mergedForReady)) {
    stateUpdate.conversationComplete = true;
    stateUpdate.amendmentResumeSearchReady = false;
    stateUpdate.searchExecutionRequested = false;
  }

  return { stateUpdate, warnings };
}
