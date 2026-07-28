/** Structured travel place contracts — provider-agnostic domain model. */

export type TravelPlaceType =
  | 'country'
  | 'state'
  | 'region'
  | 'city'
  | 'town'
  | 'island'
  | 'suburb'
  | 'neighbourhood'
  | 'airport'
  | 'station'
  | 'port'
  | 'beach'
  | 'resort'
  | 'hotel'
  | 'landmark'
  | 'attraction'
  | 'national_park'
  | 'theme_park'
  | 'ski_resort'
  | 'campground'
  | 'route'
  | 'unknown';

export type LocationMatchType =
  | 'exact'
  | 'alias'
  | 'iata'
  | 'fuzzy'
  | 'provider'
  | 'contextual';

export type LocationRole =
  | 'origin'
  | 'destination'
  | 'accommodation'
  | 'stopover'
  | 'nearby_centre'
  | 'airport'
  | 'activity'
  | 'unspecified';

export type LocationOperation =
  | 'set'
  | 'replace_destination'
  | 'replace_origin'
  | 'set_accommodation'
  | 'clarify'
  | 'none';

export type ResolvedTravelPlace = {
  id: string;
  canonicalName: string;
  displayName: string;
  type: TravelPlaceType;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
  regionName?: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  iataCode?: string;
  airportCodes?: string[];
  nearestAirportCodes?: string[];
  aliases: string[];
  matchedText: string;
  matchType: LocationMatchType;
  confidence: number;
  provider: string;
  parentPlace?: {
    id?: string;
    name: string;
    type: TravelPlaceType;
  };
  metadata?: Record<string, unknown>;
};

export type LocationResolutionResult = {
  place: ResolvedTravelPlace;
  score: number;
};

export type LocationResolutionContext = {
  roleHint?: LocationRole;
  countryHint?: string;
  language?: string;
  awaitingField?: 'origin' | 'destination' | 'accommodation' | string;
  allowFuzzy?: boolean;
  maxResults?: number;
};

export type NearbyCategory =
  | 'activities'
  | 'attractions'
  | 'restaurants'
  | 'beaches'
  | 'camping'
  | 'kayaking'
  | 'four_wheel_driving'
  | 'hiking'
  | 'scenic_drives'
  | 'shopping'
  | 'nightlife'
  | 'family'
  | 'nature'
  | 'wellness';

export type NearbyRequest = {
  category: NearbyCategory;
  radiusKm?: number;
  limit?: number;
};

export type StoredTravelLocation = {
  displayName: string;
  canonicalName: string;
  type?: TravelPlaceType;
  countryCode?: string;
  stateCode?: string;
  cityName?: string;
  regionName?: string;
  latitude?: number;
  longitude?: number;
  iataCode?: string;
  nearestAirportCodes?: string[];
  providerId?: string;
};

export type LocationSpan = {
  raw: string;
  roleHint: LocationRole;
  cue: string;
  index: number;
  operation: LocationOperation;
  confidence: number;
};

export type LocationIntelligenceEvidence = {
  locationResolutionAttempted: boolean;
  locationQuery: string | null;
  normalisedLocationQuery: string | null;
  locationProvider: string | null;
  locationCandidates: Array<{
    id: string;
    name: string;
    type: TravelPlaceType;
    confidence: number;
    matchType: LocationMatchType;
    provider: string;
  }>;
  selectedLocationCandidate: string | null;
  locationAmbiguityDetected: boolean;
  locationMatchType: LocationMatchType | null;
  locationConfidence: number | null;
  locationRole: LocationRole | null;
  locationOperation: LocationOperation | null;
  canonicalLocationBefore: string | null;
  canonicalLocationAfter: string | null;
  dependentFieldsCleared: string[];
  airportResolution: {
    iataCode?: string;
    nearestAirportCodes?: string[];
  } | null;
  originPreserved?: string | null;
};
