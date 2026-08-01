import type {
  LocationResolutionContext,
  LocationResolutionResult,
  NearbyRequest,
  ResolvedTravelPlace,
} from '../types';

export interface TravelLocationProvider {
  readonly id: string;
  resolve(
    query: string,
    context?: LocationResolutionContext,
  ): Promise<LocationResolutionResult[]>;
  resolveSync?(
    query: string,
    context?: LocationResolutionContext,
  ): LocationResolutionResult[];
  autocomplete?(
    query: string,
    context?: LocationResolutionContext,
  ): Promise<LocationResolutionResult[]>;
  nearby?(
    place: ResolvedTravelPlace,
    request: NearbyRequest,
  ): Promise<LocationResolutionResult[]>;
  reverseGeocode?(
    latitude: number,
    longitude: number,
  ): Promise<LocationResolutionResult[]>;
}
