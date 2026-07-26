import type { Money, ProviderSearchMeta } from './common';

export type TransferSearchRequest = {
  pickup: string;
  dropoff: string;
  pickupDate: string;
  pickupTime?: string;
  passengers?: number;
  currency?: string;
  signal?: AbortSignal;
};

export type TransferOffer = {
  id: string;
  providerId: string;
  supplier: string;
  vehicleType: string;
  pickup: string;
  dropoff: string;
  total: Money;
  isBookableLive: boolean;
};

export type TransferSearchResponse = {
  offers: TransferOffer[];
  meta: ProviderSearchMeta[];
  partial: boolean;
  warnings: string[];
};
