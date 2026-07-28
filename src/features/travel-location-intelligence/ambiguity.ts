import type { LocationResolutionResult } from './types';

/** Local ambiguity option types — not coupled to any conversation engine. */
export type LocationAmbiguityOption = {
  id: string;
  label: string;
  value: {
    canonicalName: string;
    placeId: string;
    type: string;
    countryCode?: string;
    iataCode?: string;
    nearestAirportCodes?: string[];
    displayName: string;
  };
  position: number;
};

export type LocationAmbiguityOptionSet = {
  id: string;
  sourceTurnId: string;
  question: string;
  options: LocationAmbiguityOption[];
  selectionMode: 'single';
  createdAt: string;
};

let locationOptionSeq = 0;

export function resetLocationOptionSequence(): void {
  locationOptionSeq = 0;
}

export function buildLocationAmbiguityOptionSet(
  question: string,
  results: LocationResolutionResult[],
): LocationAmbiguityOptionSet {
  locationOptionSeq += 1;
  const sourceTurnId = `location-turn-${locationOptionSeq}`;
  const options: LocationAmbiguityOption[] = results.slice(0, 5).map((row, index) => {
    const place = row.place;
    const where = [place.regionName ?? place.stateName, place.countryName]
      .filter(Boolean)
      .join(', ');
    const label = where ? `${place.displayName} (${where})` : place.displayName;
    return {
      id: place.id,
      label,
      value: {
        canonicalName: place.canonicalName,
        placeId: place.id,
        type: place.type,
        countryCode: place.countryCode,
        iataCode: place.iataCode,
        nearestAirportCodes: place.nearestAirportCodes,
        displayName: place.displayName,
      },
      position: index + 1,
    };
  });

  return {
    id: `location-opts-${locationOptionSeq}`,
    sourceTurnId,
    question,
    options,
    selectionMode: 'single',
    createdAt: new Date().toISOString(),
  };
}

export function formatAmbiguityQuestion(results: LocationResolutionResult[]): string {
  const labels = results.slice(0, 3).map((row) => {
    const place = row.place;
    const where = [place.regionName ?? place.stateName, place.countryName]
      .filter(Boolean)
      .join(', ');
    return where ? `${place.displayName} in ${where}` : place.displayName;
  });
  if (labels.length === 2) {
    return `Which ${results[0]?.place.canonicalName} did you mean — ${labels[0]}, or ${labels[1]}?`;
  }
  return `Which ${results[0]?.place.canonicalName} did you mean — ${labels.join(', ')}, or another one?`;
}
