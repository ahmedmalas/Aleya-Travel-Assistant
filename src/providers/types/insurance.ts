import type { Money, ProviderSearchMeta } from './common';

export type InsuranceSearchRequest = {
  destination: string;
  startDate: string;
  endDate: string;
  travellers: number;
  currency?: string;
  signal?: AbortSignal;
};

export type InsuranceOffer = {
  id: string;
  providerId: string;
  productName: string;
  coverageSummary: string;
  premium: Money;
  isBookableLive: boolean;
};

export type InsuranceSearchResponse = {
  offers: InsuranceOffer[];
  meta: ProviderSearchMeta[];
  partial: boolean;
  warnings: string[];
};
