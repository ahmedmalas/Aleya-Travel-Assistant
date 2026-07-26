import type { ProviderHealth } from '../types/common';
import type { ActivityOffer, ActivitySearchRequest, ActivitySearchResponse } from '../types/activities';
import type { CarHireOffer, CarHireSearchRequest, CarHireSearchResponse } from '../types/carHire';
import type { CruiseOffer, CruiseSearchRequest, CruiseSearchResponse } from '../types/cruises';
import type { FlightOffer, FlightSearchRequest, FlightSearchResponse } from '../types/flights';
import type { HotelOffer, HotelSearchRequest, HotelSearchResponse } from '../types/hotels';
import type { InsuranceOffer, InsuranceSearchRequest, InsuranceSearchResponse } from '../types/insurance';
import type { RailOffer, RailSearchRequest, RailSearchResponse } from '../types/rail';
import type { TransferOffer, TransferSearchRequest, TransferSearchResponse } from '../types/transfers';

/** Frontend must only talk to these interfaces — never supplier SDKs/APIs. */

export interface FlightProvider {
  readonly providerId: string;
  readonly displayName: string;
  search(request: FlightSearchRequest): Promise<FlightSearchResponse>;
  normalize(raw: Record<string, unknown>): FlightOffer;
  getHealth(): Promise<ProviderHealth>;
}

export interface HotelProvider {
  readonly providerId: string;
  readonly displayName: string;
  search(request: HotelSearchRequest): Promise<HotelSearchResponse>;
  normalize(raw: Record<string, unknown>): HotelOffer;
  getHealth(): Promise<ProviderHealth>;
}

export interface ActivitiesProvider {
  readonly providerId: string;
  readonly displayName: string;
  search(request: ActivitySearchRequest): Promise<ActivitySearchResponse>;
  normalize(raw: Record<string, unknown>): ActivityOffer;
  getHealth(): Promise<ProviderHealth>;
}

export interface CarHireProvider {
  readonly providerId: string;
  readonly displayName: string;
  search(request: CarHireSearchRequest): Promise<CarHireSearchResponse>;
  normalize(raw: Record<string, unknown>): CarHireOffer;
  getHealth(): Promise<ProviderHealth>;
}

export interface CruiseProvider {
  readonly providerId: string;
  readonly displayName: string;
  search(request: CruiseSearchRequest): Promise<CruiseSearchResponse>;
  normalize(raw: Record<string, unknown>): CruiseOffer;
  getHealth(): Promise<ProviderHealth>;
}

export interface TransferProvider {
  readonly providerId: string;
  readonly displayName: string;
  search(request: TransferSearchRequest): Promise<TransferSearchResponse>;
  normalize(raw: Record<string, unknown>): TransferOffer;
  getHealth(): Promise<ProviderHealth>;
}

export interface InsuranceProvider {
  readonly providerId: string;
  readonly displayName: string;
  search(request: InsuranceSearchRequest): Promise<InsuranceSearchResponse>;
  normalize(raw: Record<string, unknown>): InsuranceOffer;
  getHealth(): Promise<ProviderHealth>;
}

export interface RailProvider {
  readonly providerId: string;
  readonly displayName: string;
  search(request: RailSearchRequest): Promise<RailSearchResponse>;
  normalize(raw: Record<string, unknown>): RailOffer;
  getHealth(): Promise<ProviderHealth>;
}

export type AnyTravelProvider =
  | FlightProvider
  | HotelProvider
  | ActivitiesProvider
  | CarHireProvider
  | CruiseProvider
  | TransferProvider
  | InsuranceProvider
  | RailProvider;
