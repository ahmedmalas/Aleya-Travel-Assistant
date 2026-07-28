/** Destination discovery — structured criteria and session state (schema v7). */

export type DiscoveryMode = 'inactive' | 'active' | 'selected' | 'completed';

export type TripCharacter =
  | 'tropical'
  | 'beach'
  | 'city'
  | 'nature'
  | 'snow'
  | 'countryside'
  | 'island'
  | 'adventure'
  | 'relaxation'
  | 'nightlife'
  | 'family'
  | 'romantic'
  | 'cultural'
  | 'food'
  | 'wellness';

export type BudgetLevel = 'budget' | 'mid_range' | 'luxury';

export type TravellerGroup = 'solo' | 'couple' | 'family' | 'friends';

export type DiscoveryRegionBias = 'australia' | 'international' | 'pacific' | 'asia';

export type DiscoveryVibe = 'quiet' | 'lively' | 'mixed';

export type DiscoveryCriteria = {
  originLabel?: string;
  originAirportCode?: string;
  maxTravelHours?: number;
  climate: string[];
  characters: TripCharacter[];
  vibe?: DiscoveryVibe;
  budgetLevel?: BudgetLevel;
  budgetMaxAud?: number;
  durationNights?: number;
  travellers?: number;
  travellerGroup?: TravellerGroup;
  activities: string[];
  exclusions: string[];
  regionBias?: DiscoveryRegionBias;
  dateFlexibility?: string;
  flightPreference?: string;
  accommodationPreference?: string;
};

export type DiscoveryMatchStrength = 'strong' | 'good' | 'compromise';

export type DiscoveryCandidate = {
  id: string;
  placeName: string;
  iata?: string;
  score: number;
  reasons: string[];
  tradeoffs: string[];
  matchStrength: DiscoveryMatchStrength;
};

export type DiscoveryQuestionId =
  | 'origin_or_travel_time'
  | 'vibe_quiet_nightlife'
  | 'budget'
  | 'trip_character'
  | 'traveller_group'
  | 'duration'
  | 'region';

export type DestinationDiscoveryState = {
  mode: DiscoveryMode;
  criteria: DiscoveryCriteria;
  pendingQuestionId?: DiscoveryQuestionId;
  lastQuestionId?: DiscoveryQuestionId;
  recommendations: DiscoveryCandidate[];
  rejectedIds: string[];
  selectedId?: string;
  selectedPlaceName?: string;
  lastRecommendedIds: string[];
  lastAction?: string;
};

export function emptyDiscoveryCriteria(): DiscoveryCriteria {
  return {
    climate: [],
    characters: [],
    activities: [],
    exclusions: [],
  };
}

export function createActiveDiscoveryState(
  criteria: DiscoveryCriteria = emptyDiscoveryCriteria(),
): DestinationDiscoveryState {
  return {
    mode: 'active',
    criteria,
    recommendations: [],
    rejectedIds: [],
    lastRecommendedIds: [],
  };
}
