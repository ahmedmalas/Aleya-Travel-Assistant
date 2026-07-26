import type { LocationRef, Money, ProviderSearchMeta } from './common';

export type FlightCabin = 'economy' | 'premium_economy' | 'business' | 'first';

export type FlightSearchRequest = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  travellers: number;
  cabin?: FlightCabin | string;
  currency?: string;
  signal?: AbortSignal;
};

export type FlightOffer = {
  id: string;
  providerId: string;
  airline: string;
  flightNumber: string;
  departure: {
    airport: LocationRef;
    at: string;
  };
  arrival: {
    airport: LocationRef;
    at: string;
  };
  durationMinutes: number;
  stops: number;
  baggage: string;
  fare: Money;
  cabin: string;
  bookingToken: string;
  /** Planning-only until live booking is approved. */
  isBookableLive: boolean;
};

export type FlightSearchResponse = {
  offers: FlightOffer[];
  meta: ProviderSearchMeta[];
  partial: boolean;
  warnings: string[];
};
