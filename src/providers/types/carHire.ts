import type { Money, ProviderSearchMeta } from './common';

export type CarHireSearchRequest = {
  pickupLocation: string;
  dropoffLocation?: string;
  pickupDate: string;
  dropoffDate: string;
  drivers?: number;
  currency?: string;
  signal?: AbortSignal;
};

export type CarHireOffer = {
  id: string;
  providerId: string;
  supplier: string;
  vehicleClass: string;
  pickupLocation: string;
  dropoffLocation: string;
  total: Money;
  isBookableLive: boolean;
};

export type CarHireSearchResponse = {
  offers: CarHireOffer[];
  meta: ProviderSearchMeta[];
  partial: boolean;
  warnings: string[];
};
