import type { Money, ProviderSearchMeta } from './common';

export type HotelSearchRequest = {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms?: number;
  currency?: string;
  preferences?: string;
  signal?: AbortSignal;
};

export type HotelOffer = {
  id: string;
  providerId: string;
  property: string;
  location: string;
  rating: number;
  room: string;
  cancellationPolicy: string;
  nightlyRate: Money;
  taxes: Money;
  images: string[];
  isBookableLive: boolean;
};

export type HotelSearchResponse = {
  offers: HotelOffer[];
  meta: ProviderSearchMeta[];
  partial: boolean;
  warnings: string[];
};
