import type { Money, ProviderSearchMeta } from './common';

export type RailSearchRequest = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  travellers?: number;
  currency?: string;
  signal?: AbortSignal;
};

export type RailOffer = {
  id: string;
  providerId: string;
  operator: string;
  trainNumber: string;
  origin: string;
  destination: string;
  departAt: string;
  arriveAt: string;
  fare: Money;
  isBookableLive: boolean;
};

export type RailSearchResponse = {
  offers: RailOffer[];
  meta: ProviderSearchMeta[];
  partial: boolean;
  warnings: string[];
};
