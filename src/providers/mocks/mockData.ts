import type { ActivityOffer } from '../types/activities';
import type { CarHireOffer } from '../types/carHire';
import type { CruiseOffer } from '../types/cruises';
import type { FlightOffer } from '../types/flights';
import type { HotelOffer } from '../types/hotels';
import type { InsuranceOffer } from '../types/insurance';
import type { RailOffer } from '../types/rail';
import type { TransferOffer } from '../types/transfers';

const MOCK_WARNING = 'Mock inventory only — live supplier APIs are not connected.';

export function mockWarning(): string {
  return MOCK_WARNING;
}

export function buildMockFlights(
  providerId: string,
  origin: string,
  destination: string,
  departDate: string,
  cabin: string,
  currency: string,
): FlightOffer[] {
  const originCode =
    origin.match(/\(([A-Z]{3})\)/)?.[1] ??
    (origin.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'XXX');
  const destCode =
    destination.match(/\(([A-Z]{3})\)/)?.[1] ??
    (destination.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'YYY');
  return [
    {
      id: `${providerId}:flight:1`,
      providerId,
      airline: 'Demo Air',
      flightNumber: 'TB101',
      departure: {
        airport: { code: originCode, name: origin },
        at: `${departDate}T09:15:00`,
      },
      arrival: {
        airport: { code: destCode, name: destination },
        at: `${departDate}T18:40:00`,
      },
      durationMinutes: 565,
      stops: 0,
      baggage: '1 × 23kg',
      fare: { amount: 842, currency },
      cabin,
      bookingToken: `mock-token-${providerId}-1`,
      isBookableLive: false,
    },
    {
      id: `${providerId}:flight:2`,
      providerId,
      airline: 'Pacific Demo',
      flightNumber: 'TB220',
      departure: {
        airport: { code: originCode, name: origin },
        at: `${departDate}T22:05:00`,
      },
      arrival: {
        airport: { code: destCode, name: destination },
        at: `${departDate}T07:55:00`,
      },
      durationMinutes: 710,
      stops: 1,
      baggage: 'Cabin only',
      fare: { amount: 619, currency },
      cabin,
      bookingToken: `mock-token-${providerId}-2`,
      isBookableLive: false,
    },
  ];
}

export function buildMockHotels(
  providerId: string,
  destination: string,
  currency: string,
): HotelOffer[] {
  return [
    {
      id: `${providerId}:hotel:1`,
      providerId,
      property: `${destination} Harbour Suites (demo)`,
      location: destination,
      rating: 4.4,
      room: 'Deluxe King',
      cancellationPolicy: 'Free cancellation until 48h before check-in (demo policy)',
      nightlyRate: { amount: 218, currency },
      taxes: { amount: 32, currency },
      images: [],
      isBookableLive: false,
    },
    {
      id: `${providerId}:hotel:2`,
      providerId,
      property: `${destination} City Lodge (demo)`,
      location: destination,
      rating: 3.9,
      room: 'Twin Room',
      cancellationPolicy: 'Non-refundable demo rate',
      nightlyRate: { amount: 129, currency },
      taxes: { amount: 18, currency },
      images: [],
      isBookableLive: false,
    },
  ];
}

export function buildMockActivities(
  providerId: string,
  destination: string,
  currency: string,
): ActivityOffer[] {
  return [
    {
      id: `${providerId}:activity:1`,
      providerId,
      supplier: providerId,
      title: `${destination} walking tour (demo)`,
      destination,
      category: 'sightseeing',
      duration: '3 hours',
      pricing: { amount: 65, currency },
      isBookableLive: false,
    },
  ];
}

export function buildMockCarHire(
  providerId: string,
  pickup: string,
  dropoff: string,
  currency: string,
): CarHireOffer[] {
  return [
    {
      id: `${providerId}:car:1`,
      providerId,
      supplier: providerId,
      vehicleClass: 'Compact',
      pickupLocation: pickup,
      dropoffLocation: dropoff || pickup,
      total: { amount: 74, currency },
      isBookableLive: false,
    },
  ];
}

export function buildMockCruises(
  providerId: string,
  region: string,
  currency: string,
): CruiseOffer[] {
  return [
    {
      id: `${providerId}:cruise:1`,
      providerId,
      line: 'Demo Cruises',
      ship: 'MV Sample Sea',
      itineraryName: `${region || 'Coastal'} Explorer (demo)`,
      departurePort: region || 'Sydney',
      nights: 7,
      cabinType: 'Balcony',
      fareFrom: { amount: 1299, currency },
      isBookableLive: false,
    },
  ];
}

export function buildMockTransfers(
  providerId: string,
  pickup: string,
  dropoff: string,
  currency: string,
): TransferOffer[] {
  return [
    {
      id: `${providerId}:transfer:1`,
      providerId,
      supplier: providerId,
      vehicleType: 'Private sedan',
      pickup,
      dropoff,
      total: { amount: 85, currency },
      isBookableLive: false,
    },
  ];
}

export function buildMockInsurance(
  providerId: string,
  destination: string,
  currency: string,
): InsuranceOffer[] {
  return [
    {
      id: `${providerId}:insurance:1`,
      providerId,
      productName: 'Comprehensive travel cover (demo)',
      coverageSummary: `Medical + cancellation for ${destination}`,
      premium: { amount: 96, currency },
      isBookableLive: false,
    },
  ];
}

export function buildMockRail(
  providerId: string,
  origin: string,
  destination: string,
  departDate: string,
  currency: string,
): RailOffer[] {
  return [
    {
      id: `${providerId}:rail:1`,
      providerId,
      operator: 'Demo Rail',
      trainNumber: 'TR100',
      origin,
      destination,
      departAt: `${departDate}T08:00:00`,
      arriveAt: `${departDate}T12:30:00`,
      fare: { amount: 54, currency },
      isBookableLive: false,
    },
  ];
}
