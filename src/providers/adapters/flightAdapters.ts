import type { FlightProvider } from '../interfaces/providers';
import { buildMockFlights, mockWarning } from '../mocks/mockData';
import type { ProviderHealth, SupplierStatus } from '../types/common';
import type { FlightOffer, FlightSearchRequest, FlightSearchResponse } from '../types/flights';

function flightHealth(
  providerId: string,
  displayName: string,
  supplierStatus: SupplierStatus,
): ProviderHealth {
  return {
    providerId,
    displayName,
    status: supplierStatus === 'enabled' ? 'healthy' : 'not_configured',
    mode: 'mock',
    supplierStatus,
    message:
      supplierStatus === 'enabled'
        ? 'Serving mock flight inventory. Live API not connected.'
        : `Supplier status: ${supplierStatus}`,
    checkedAt: new Date().toISOString(),
  };
}

function createFlightAdapter(options: {
  providerId: string;
  displayName: string;
  supplierStatus: SupplierStatus;
}): FlightProvider {
  const { providerId, displayName, supplierStatus } = options;
  return {
    providerId,
    displayName,
    async search(request: FlightSearchRequest): Promise<FlightSearchResponse> {
      if (supplierStatus !== 'enabled') {
        return {
          offers: [],
          meta: [],
          partial: false,
          warnings: [`${displayName} is ${supplierStatus} — skipped.`],
        };
      }
      const currency = request.currency ?? 'AUD';
      const cabin = String(request.cabin ?? 'economy');
      const offers = buildMockFlights(
        providerId,
        request.origin,
        request.destination,
        request.departDate,
        cabin,
        currency,
      );
      return {
        offers,
        meta: [
          {
            providerId,
            displayName,
            mode: 'mock',
            searchedAt: new Date().toISOString(),
            isLiveInventory: false,
            warning: mockWarning(),
          },
        ],
        partial: false,
        warnings: [mockWarning()],
      };
    },
    normalize(raw: Record<string, unknown>): FlightOffer {
      return {
        id: String(raw.id ?? `${providerId}:normalized`),
        providerId,
        airline: String(raw.airline ?? 'Unknown'),
        flightNumber: String(raw.flightNumber ?? ''),
        departure: {
          airport: { name: String(raw.origin ?? ''), code: String(raw.originCode ?? '') || undefined },
          at: String(raw.departAt ?? ''),
        },
        arrival: {
          airport: { name: String(raw.destination ?? ''), code: String(raw.destCode ?? '') || undefined },
          at: String(raw.arriveAt ?? ''),
        },
        durationMinutes: Number(raw.durationMinutes ?? 0),
        stops: Number(raw.stops ?? 0),
        baggage: String(raw.baggage ?? ''),
        fare: {
          amount: Number((raw.fare as { amount?: number } | undefined)?.amount ?? raw.amount ?? 0),
          currency: String((raw.fare as { currency?: string } | undefined)?.currency ?? raw.currency ?? 'AUD'),
        },
        cabin: String(raw.cabin ?? 'economy'),
        bookingToken: String(raw.bookingToken ?? ''),
        isBookableLive: false,
      };
    },
    async getHealth() {
      return flightHealth(providerId, displayName, supplierStatus);
    },
  };
}

export function createMockFlightProvider(status: SupplierStatus = 'enabled'): FlightProvider {
  return createFlightAdapter({
    providerId: 'mock-flights',
    displayName: 'Travel Buddy Mock Flights',
    supplierStatus: status,
  });
}

/** Amadeus-shaped adapter — returns mock data until live approval. */
export function createAmadeusFlightAdapter(status: SupplierStatus = 'enabled'): FlightProvider {
  return createFlightAdapter({
    providerId: 'amadeus',
    displayName: 'Amadeus',
    supplierStatus: status,
  });
}

/** Duffel-shaped adapter — returns mock data until live approval. */
export function createDuffelFlightAdapter(status: SupplierStatus = 'disabled'): FlightProvider {
  return createFlightAdapter({
    providerId: 'duffel',
    displayName: 'Duffel',
    supplierStatus: status,
  });
}
