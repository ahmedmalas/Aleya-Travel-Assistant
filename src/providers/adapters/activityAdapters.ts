import type { ActivitiesProvider } from '../interfaces/providers';
import { buildMockActivities, mockWarning } from '../mocks/mockData';
import type { ProviderHealth, SupplierStatus } from '../types/common';
import type { ActivityOffer, ActivitySearchRequest, ActivitySearchResponse } from '../types/activities';

function createActivityAdapter(options: {
  providerId: string;
  displayName: string;
  supplierStatus: SupplierStatus;
}): ActivitiesProvider {
  const { providerId, displayName, supplierStatus } = options;
  return {
    providerId,
    displayName,
    async search(request: ActivitySearchRequest): Promise<ActivitySearchResponse> {
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
        offers: buildMockActivities(providerId, request.destination, currency),
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
    normalize(raw: Record<string, unknown>): ActivityOffer {
      return {
        id: String(raw.id ?? `${providerId}:normalized`),
        providerId,
        supplier: String(raw.supplier ?? providerId),
        title: String(raw.title ?? ''),
        destination: String(raw.destination ?? ''),
        category: String(raw.category ?? 'activity'),
        duration: String(raw.duration ?? ''),
        pricing: {
          amount: Number((raw.pricing as { amount?: number } | undefined)?.amount ?? 0),
          currency: String((raw.pricing as { currency?: string } | undefined)?.currency ?? 'AUD'),
        },
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
            ? 'Serving mock activity inventory. Live API not connected.'
            : `Supplier status: ${supplierStatus}`,
        checkedAt: new Date().toISOString(),
      };
    },
  };
}

export function createMockActivitiesProvider(status: SupplierStatus = 'enabled'): ActivitiesProvider {
  return createActivityAdapter({
    providerId: 'mock-activities',
    displayName: 'Travel Buddy Mock Activities',
    supplierStatus: status,
  });
}

export function createViatorActivitiesAdapter(status: SupplierStatus = 'enabled'): ActivitiesProvider {
  return createActivityAdapter({
    providerId: 'viator',
    displayName: 'Viator',
    supplierStatus: status,
  });
}
