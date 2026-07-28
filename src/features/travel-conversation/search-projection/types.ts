import type { TravelServiceKind } from '../types';

/**
 * Where the adult count came from.
 * - explicit: stored on canonical travel state (user said how many)
 * - product_default: approved visible default of exactly 1 adult
 *
 * Fabricating 2 adults is forbidden.
 */
export type TravellerCountSource = 'explicit' | 'product_default';

/** Authoritative handoff from canonical conversation state → every provider search. */
export type CanonicalSearchProjection = {
  /** Departure city / airport — maps only from state.origin */
  origin: {
    label?: string;
    airportCode?: string;
  };
  /** Arrival city / airport — maps only from state.destination */
  destination: {
    label?: string;
    airportCode?: string;
  };
  /** Outbound date (ISO yyyy-mm-dd) — maps only from state.departureDate */
  departureDate?: string;
  /** Inbound date (ISO yyyy-mm-dd) — maps only from state.returnDate */
  returnDate?: string;
  /** Selected services — maps only from state.services */
  services: TravelServiceKind[];
  /**
   * Adult travellers for provider search.
   * Explicit stored count, else product_default of 1. Never inferred as 2.
   */
  adults: number;
  travellerSource: TravellerCountSource;
};

/** Form-binding view of the canonical projection (UI fields only). */
export type SearchFormProjection = {
  originCode?: string;
  destinationCode?: string;
  originLabel?: string;
  destinationLabel?: string;
  departDate?: string;
  returnDate?: string;
  adults: number;
  travellerSource: TravellerCountSource;
};

/** Provider request view of the canonical projection. */
export type SearchRequestProjection = {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  services: TravelServiceKind[];
  adults: number;
  travellerSource: TravellerCountSource;
};

export type ProviderSearchOpen = {
  service: TravelServiceKind;
  url: string;
  originCode?: string;
  destinationCode?: string;
  destinationLabel?: string;
  departDate?: string;
  returnDate?: string;
  adults: number;
  travellerSource: TravellerCountSource;
};

export type ProviderLaunchStatus =
  | 'opened'
  | 'ready_for_user'
  | 'blocked'
  | 'failed';

/** Real provider launch outcome — never assume attempted === opened. */
export type ProviderLaunchResult = {
  service: TravelServiceKind;
  provider: string;
  url: string;
  status: ProviderLaunchStatus;
  reason?: string;
  destinationLabel?: string;
  departDate?: string;
  returnDate?: string;
};

export type SearchLaunchSession = {
  id: string;
  activationId: number;
  createdAt: string;
  conversationId: string;
  projection: CanonicalSearchProjection;
  results: ProviderLaunchResult[];
};

export type LiveSearchResult = {
  projection: CanonicalSearchProjection;
  /** @deprecated Use launchResults — never treat this as verified opens. */
  opened: TravelServiceKind[];
  providerSearches: ProviderSearchOpen[];
  unavailable: Array<{ service: TravelServiceKind; reason: string }>;
  activationId: number;
  /** Verified launch outcomes for conversation observation + UI. */
  launchResults: ProviderLaunchResult[];
};
