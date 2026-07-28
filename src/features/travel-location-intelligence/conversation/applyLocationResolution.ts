import type { LocationCandidate } from '../../travel-conversation/candidates/types';
import {
  buildLocationAmbiguityOptionSet,
  formatAmbiguityQuestion,
} from '../ambiguity';
import { getDefaultLocationProvider } from '../providers/compositeProvider';
import { isAmbiguousResults } from '../rank';
import type {
  LocationIntelligenceEvidence,
  LocationResolutionResult,
  LocationRole,
  ResolvedTravelPlace,
  StoredTravelLocation,
} from '../types';
import { extractLocationSpans } from './buildCandidates';
import type { ActiveOptionSet } from '../../travel-conversation/contextual-reference/types';

export type LocationResolutionPass = {
  candidates: LocationCandidate[];
  ambiguity: ActiveOptionSet | null;
  ambiguityQuestion: string | null;
  selectedPlaces: Partial<Record<LocationRole, ResolvedTravelPlace>>;
  evidence: LocationIntelligenceEvidence;
  replaceDestination: boolean;
};

function emptyEvidence(): LocationIntelligenceEvidence {
  return {
    locationResolutionAttempted: false,
    locationQuery: null,
    normalisedLocationQuery: null,
    locationProvider: null,
    locationCandidates: [],
    selectedLocationCandidate: null,
    locationAmbiguityDetected: false,
    locationMatchType: null,
    locationConfidence: null,
    locationRole: null,
    locationOperation: null,
    canonicalLocationBefore: null,
    canonicalLocationAfter: null,
    dependentFieldsCleared: [],
    airportResolution: null,
    originPreserved: null,
  };
}

export function toStoredTravelLocation(place: ResolvedTravelPlace): StoredTravelLocation {
  return {
    displayName: place.displayName,
    canonicalName: place.canonicalName,
    type: place.type,
    countryCode: place.countryCode,
    stateCode: place.stateCode,
    cityName: place.cityName ?? place.parentPlace?.name,
    regionName: place.regionName,
    latitude: place.latitude,
    longitude: place.longitude,
    iataCode: place.iataCode ?? place.nearestAirportCodes?.[0],
    nearestAirportCodes: place.nearestAirportCodes ?? place.airportCodes,
    providerId: place.id,
  };
}

function roleForCandidate(role: LocationRole): LocationCandidate['roleHint'] {
  if (role === 'origin') return 'origin';
  if (role === 'destination') return 'destination';
  if (role === 'accommodation') return 'accommodation';
  return 'unspecified';
}

/**
 * Synchronous resolution pass used by the conversation engine (local + cache).
 * Remote enrichment is available via resolveLocationsForMessageAsync.
 */
export function resolveLocationsForMessageSync(input: {
  message: string;
  awaitingField?: string;
  destinationBefore?: string;
  originBefore?: string;
}): LocationResolutionPass {
  const evidence = emptyEvidence();
  evidence.canonicalLocationBefore = input.destinationBefore ?? null;
  evidence.originPreserved = input.originBefore ?? null;

  const spans = extractLocationSpans(input.message);
  if (!spans.length) {
    return {
      candidates: [],
      ambiguity: null,
      ambiguityQuestion: null,
      selectedPlaces: {},
      evidence,
      replaceDestination: false,
    };
  }

  evidence.locationResolutionAttempted = true;
  const provider = getDefaultLocationProvider();
  const candidates: LocationCandidate[] = [];
  const selectedPlaces: Partial<Record<LocationRole, ResolvedTravelPlace>> = {};
  let ambiguity: ActiveOptionSet | null = null;
  let ambiguityQuestion: string | null = null;
  let replaceDestination = false;

  for (const span of spans) {
    evidence.locationQuery = span.raw;
    evidence.normalisedLocationQuery = span.raw;
    evidence.locationRole = span.roleHint;
    evidence.locationOperation = span.operation;

    const roleHint =
      span.roleHint === 'unspecified' && input.awaitingField === 'origin'
        ? 'origin'
        : span.roleHint === 'unspecified' && input.awaitingField === 'destination'
          ? 'destination'
          : span.roleHint;

    const results = provider.resolveSync(span.raw, {
      roleHint: roleHint === 'activity' ? 'nearby_centre' : roleHint,
      awaitingField: input.awaitingField,
      allowFuzzy: true,
      maxResults: 6,
    });

    evidence.locationProvider = results[0]?.place.provider ?? 'local';
    evidence.locationCandidates = results.map((r) => ({
      id: r.place.id,
      name: r.place.canonicalName,
      type: r.place.type,
      confidence: r.place.confidence,
      matchType: r.place.matchType,
      provider: r.place.provider,
    }));

    if (!results.length) continue;

    // Ambiguity: short bare names with multiple distinct places
    if (
      (span.roleHint === 'destination' || span.roleHint === 'unspecified') &&
      isAmbiguousResults(results) &&
      !span.raw.toLowerCase().includes('island') &&
      span.raw.trim().split(/\s+/).length <= 2
    ) {
      ambiguityQuestion = formatAmbiguityQuestion(results);
      ambiguity = buildLocationAmbiguityOptionSet(ambiguityQuestion, results);
      evidence.locationAmbiguityDetected = true;
      continue;
    }

    const best = pickBest(results, roleHint);
    if (!best) continue;

    evidence.selectedLocationCandidate = best.place.id;
    evidence.locationMatchType = best.place.matchType;
    evidence.locationConfidence = best.place.confidence;
    evidence.airportResolution = {
      iataCode: best.place.iataCode,
      nearestAirportCodes: best.place.nearestAirportCodes ?? best.place.airportCodes,
    };

    let mappedRole = roleForCandidate(
      roleHint === 'activity' ? 'unspecified' : (roleHint as LocationRole),
    );

    // Accommodation localities must never become trip origin — even when origin is awaiting.
    // Bare suburb/beach answers are accommodation areas, not destination replacements.
    let place = best.place;
    const isLocality =
      place.type === 'suburb' ||
      place.type === 'neighbourhood' ||
      place.type === 'beach' ||
      place.type === 'hotel' ||
      place.type === 'resort';
    if (
      isLocality &&
      (mappedRole === 'origin' ||
        mappedRole === 'unspecified' ||
        (mappedRole === 'destination' && span.cue === 'standalone'))
    ) {
      mappedRole = 'accommodation';
    }

    // Airports used as origin/destination → parent city; keep airport IATA on the city place.
    if (
      place.parentPlace &&
      (mappedRole === 'origin' || mappedRole === 'destination') &&
      place.type === 'airport'
    ) {
      place = {
        ...place,
        canonicalName: place.parentPlace.name,
        displayName: place.parentPlace.name,
        type: place.parentPlace.type,
        iataCode: place.iataCode,
        nearestAirportCodes: place.airportCodes ?? (place.iataCode ? [place.iataCode] : []),
      };
    }

    // Accommodation area: keep area name; infer parent destination separately
    if (mappedRole === 'accommodation') {
      selectedPlaces.accommodation = place;
      candidates.push({
        kind: 'location',
        raw: span.raw,
        normalized: place.canonicalName,
        roleHint: 'accommodation',
        cue: span.cue,
        index: span.index,
        confidence: place.confidence,
        source: 'explicit',
      });
      if (place.parentPlace && !selectedPlaces.destination) {
        selectedPlaces.destination = {
          ...place,
          id: `${place.id}-parent`,
          canonicalName: place.parentPlace.name,
          displayName: place.parentPlace.name,
          type: place.parentPlace.type,
          confidence: Math.min(place.confidence, 0.55),
          matchType: 'contextual',
        };
        candidates.push({
          kind: 'location',
          raw: place.parentPlace.name,
          normalized: place.parentPlace.name,
          roleHint: 'destination',
          cue: `${span.cue}-parent`,
          index: span.index,
          confidence: 0.45,
          source: 'inferred',
        });
      }
      continue;
    }

    const effectiveRole: LocationCandidate['roleHint'] =
      mappedRole === 'unspecified' ? 'destination' : mappedRole;
    selectedPlaces[effectiveRole] = place;
    candidates.push({
      kind: 'location',
      raw: span.raw,
      normalized: place.canonicalName,
      roleHint: effectiveRole,
      cue: span.cue,
      index: span.index,
      confidence: Math.max(span.confidence, place.confidence),
      source: 'explicit',
    });

    if (span.operation === 'replace_destination') {
      replaceDestination = true;
      evidence.locationOperation = 'replace_destination';
    }
  }

  if (selectedPlaces.destination) {
    evidence.canonicalLocationAfter = selectedPlaces.destination.canonicalName;
  }

  return {
    candidates,
    ambiguity,
    ambiguityQuestion,
    selectedPlaces,
    evidence,
    replaceDestination,
  };
}

function pickBest(
  results: LocationResolutionResult[],
  roleHint: string,
): LocationResolutionResult | undefined {
  if (!results.length) return undefined;
  // Prefer island over city when query mentions island
  const ranked = [...results].sort((a, b) => {
    if (roleHint === 'destination') {
      const aIsland = a.place.type === 'island' ? 1 : 0;
      const bIsland = b.place.type === 'island' ? 1 : 0;
      if (aIsland !== bIsland) return bIsland - aIsland;
    }
    return b.score - a.score;
  });
  return ranked[0];
}

export async function resolveLocationsForMessageAsync(input: {
  message: string;
  awaitingField?: string;
  destinationBefore?: string;
  originBefore?: string;
}): Promise<LocationResolutionPass> {
  // Warm remote cache for each span, then reuse sync path (reads cache).
  const spans = extractLocationSpans(input.message);
  const provider = getDefaultLocationProvider();
  for (const span of spans) {
    try {
      await provider.resolve(span.raw, {
        awaitingField: input.awaitingField,
        allowFuzzy: true,
        maxResults: 6,
      });
    } catch {
      // Remote failure must not corrupt trip state.
    }
  }
  return resolveLocationsForMessageSync(input);
}
