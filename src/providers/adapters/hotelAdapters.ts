import type { HotelProvider } from '../interfaces/providers';
import { buildMockHotels, mockWarning } from '../mocks/mockData';
import type { ProviderHealth, SupplierStatus } from '../types/common';
import type { HotelOffer, HotelSearchRequest, HotelSearchResponse } from '../types/hotels';

function createHotelAdapter(options: {
  providerId: string;
  displayName: string;
  supplierStatus: SupplierStatus;
}): HotelProvider {
  const { providerId, displayName, supplierStatus } = options;
  return {
    providerId,
    displayName,
    async search(request: HotelSearchRequest): Promise<HotelSearchResponse> {
      if (supplierStatus !== 'enabled') {
        return {
          offers: [],
          meta: [],
          partial: false,
          warnings: [`${displayName} is ${supplierStatus} — skipped.`],
        };
      }
      const currency = request.currency ?? 'AUD';
      return {
        offers: buildMockHotels(providerId, request.destination, currency),
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
    normalize(raw: Record<string, unknown>): HotelOffer {
      return {
        id: String(raw.id ?? `${providerId}:normalized`),
        providerId,
        property: String(raw.property ?? raw.name ?? 'Hotel'),
        location: String(raw.location ?? ''),
        rating: Number(raw.rating ?? 0),
        room: String(raw.room ?? ''),
        cancellationPolicy: String(raw.cancellationPolicy ?? ''),
        nightlyRate: {
          amount: Number((raw.nightlyRate as { amount?: number } | undefined)?.amount ?? 0),
          currency: String((raw.nightlyRate as { currency?: string } | undefined)?.currency ?? 'AUD'),
        },
        taxes: {
          amount: Number((raw.taxes as { amount?: number } | undefined)?.amount ?? 0),
          currency: String((raw.taxes as { currency?: string } | undefined)?.currency ?? 'AUD'),
        },
        images: Array.isArray(raw.images) ? raw.images.map(String) : [],
        isBookableLive: false,
      };
    },
    async getHealth(): Promise<ProviderHealth> {
      return {
        providerId,
        displayName,
        status: supplierStatus === 'enabled' ? 'healthy' : 'not_configured',
        mode: 'mock',
        supplierStatus,
        message:
          supplierStatus === 'enabled'
            ? 'Serving mock hotel inventory. Live API not connected.'
            : `Supplier status: ${supplierStatus}`,
        checkedAt: new Date().toISOString(),
      };
    },
  };
}

export function createMockHotelProvider(status: SupplierStatus = 'enabled'): HotelProvider {
  return createHotelAdapter({
    providerId: 'mock-hotels',
    displayName: 'Travel Buddy Mock Hotels',
    supplierStatus: status,
  });
}

export function createBookingComHotelAdapter(status: SupplierStatus = 'pending'): HotelProvider {
  return createHotelAdapter({
    providerId: 'booking-com',
    displayName: 'Booking.com',
    supplierStatus: status,
  });
}

export function createExpediaRapidHotelAdapter(status: SupplierStatus = 'disabled'): HotelProvider {
  return createHotelAdapter({
    providerId: 'expedia-rapid',
    displayName: 'Expedia Rapid',
    supplierStatus: status,
  });
}

export function createHotelbedsHotelAdapter(status: SupplierStatus = 'disabled'): HotelProvider {
  return createHotelAdapter({
    providerId: 'hotelbeds',
    displayName: 'Hotelbeds',
    supplierStatus: status,
  });
}
