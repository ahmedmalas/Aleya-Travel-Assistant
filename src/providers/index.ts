export type {
  FlightProvider,
  HotelProvider,
  ActivitiesProvider,
  CarHireProvider,
  CruiseProvider,
  TransferProvider,
  InsuranceProvider,
  RailProvider,
} from './interfaces/providers';

export type { FlightOffer, FlightSearchRequest, FlightSearchResponse } from './types/flights';
export type { HotelOffer, HotelSearchRequest, HotelSearchResponse } from './types/hotels';
export type { ActivityOffer, ActivitySearchRequest, ActivitySearchResponse } from './types/activities';
export type { CarHireOffer, CarHireSearchRequest, CarHireSearchResponse } from './types/carHire';
export type { CruiseOffer, CruiseSearchRequest, CruiseSearchResponse } from './types/cruises';
export type { TransferOffer, TransferSearchRequest, TransferSearchResponse } from './types/transfers';
export type { InsuranceOffer, InsuranceSearchRequest, InsuranceSearchResponse } from './types/insurance';
export type { RailOffer, RailSearchRequest, RailSearchResponse } from './types/rail';
export type { ProviderHealth, SupplierStatus, ProviderMode } from './types/common';

export {
  searchFlights,
  searchHotels,
  searchActivities,
  searchCarHire,
  searchCruises,
  searchTransfers,
  searchInsurance,
  searchRail,
  listProviderHealth,
  describeProviderArchitecture,
  configureProvidersForTests,
  loadSupplierConfig,
  resetProviderRegistry,
  getProviderRegistry,
} from './gateway';

export { withSupplierStatus, listEnabledSuppliers } from './config/supplierConfig';
export { loadTravelSecrets, isLiveTravelProxyEnabled } from './config/secrets';
