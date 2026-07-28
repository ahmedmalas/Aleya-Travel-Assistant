export type {
  TravelPlaceType,
  ResolvedTravelPlace,
  LocationResolutionResult,
  LocationResolutionContext,
  NearbyCategory,
  NearbyRequest,
  StoredTravelLocation,
  LocationIntelligenceEvidence,
  LocationRole,
  LocationOperation,
} from './types';

export { normalizeLocationQuery, normalizePlaceToken, editDistance } from './normalize';
export { looksLikeNonPlace, classifyPlaceType } from './classify';
export { clearLocationCache } from './cache';
export { rankLocationResults, isAmbiguousResults } from './rank';
export {
  buildLocationAmbiguityOptionSet,
  formatAmbiguityQuestion,
  resetLocationOptionSequence,
  type LocationAmbiguityOption,
  type LocationAmbiguityOptionSet,
} from './ambiguity';
export {
  getDefaultLocationProvider,
  setDefaultLocationProviderForTests,
  CompositeTravelLocationProvider,
} from './providers/compositeProvider';
export { LocalTravelLocationProvider } from './providers/localProvider';
export {
  RemoteTravelLocationProvider,
  isRemoteLocationProviderEnabled,
} from './providers/remoteProvider';
export {
  resolveAirportSync,
  primaryIataForPlace,
  iataCodesForPlace,
} from './airports/resolveAirport';
export { findNearbyCurated } from './proximity/nearby';
export { resolveSync, resolveAsync } from './resolve';
