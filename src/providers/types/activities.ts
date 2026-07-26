import type { Money, ProviderSearchMeta } from './common';

export type ActivitySearchRequest = {
  destination: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  travellers?: number;
  currency?: string;
  signal?: AbortSignal;
};

export type ActivityOffer = {
  id: string;
  providerId: string;
  supplier: string;
  title: string;
  destination: string;
  category: string;
  duration: string;
  pricing: Money;
  isBookableLive: boolean;
};

export type ActivitySearchResponse = {
  offers: ActivityOffer[];
  meta: ProviderSearchMeta[];
  partial: boolean;
  warnings: string[];
};
