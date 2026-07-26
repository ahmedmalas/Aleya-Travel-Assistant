import type { Money, ProviderSearchMeta } from './common';

export type CruiseSearchRequest = {
  region?: string;
  departurePort?: string;
  startDate?: string;
  endDate?: string;
  travellers?: number;
  currency?: string;
  signal?: AbortSignal;
};

export type CruiseOffer = {
  id: string;
  providerId: string;
  line: string;
  ship: string;
  itineraryName: string;
  departurePort: string;
  nights: number;
  cabinType: string;
  fareFrom: Money;
  isBookableLive: boolean;
};

export type CruiseSearchResponse = {
  offers: CruiseOffer[];
  meta: ProviderSearchMeta[];
  partial: boolean;
  warnings: string[];
};
