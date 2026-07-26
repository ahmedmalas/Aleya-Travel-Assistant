import type {
  CarHireProvider,
  CruiseProvider,
  InsuranceProvider,
  RailProvider,
  TransferProvider,
} from '../interfaces/providers';
import {
  buildMockCarHire,
  buildMockCruises,
  buildMockInsurance,
  buildMockRail,
  buildMockTransfers,
  mockWarning,
} from '../mocks/mockData';
import type { ProviderHealth, SupplierStatus } from '../types/common';

function health(
  providerId: string,
  displayName: string,
  supplierStatus: SupplierStatus,
  kind: string,
): ProviderHealth {
  return {
    providerId,
    displayName,
    status: supplierStatus === 'enabled' ? 'healthy' : 'not_configured',
    mode: 'mock',
    supplierStatus,
    message:
      supplierStatus === 'enabled'
        ? `Serving mock ${kind} inventory. Live API not connected.`
        : `Supplier status: ${supplierStatus}`,
    checkedAt: new Date().toISOString(),
  };
}

export function createMockCarHireProvider(status: SupplierStatus = 'enabled'): CarHireProvider {
  const providerId = 'mock-car-hire';
  const displayName = 'Travel Buddy Mock Car Hire';
  return {
    providerId,
    displayName,
    async search(request) {
      if (status !== 'enabled') {
        return { offers: [], meta: [], partial: false, warnings: [`${displayName} is ${status}`] };
      }
      const currency = request.currency ?? 'AUD';
      return {
        offers: buildMockCarHire(providerId, request.pickupLocation, request.dropoffLocation ?? request.pickupLocation, currency),
        meta: [{ providerId, displayName, mode: 'mock', searchedAt: new Date().toISOString(), isLiveInventory: false, warning: mockWarning() }],
        partial: false,
        warnings: [mockWarning()],
      };
    },
    normalize(raw) {
      return {
        id: String(raw.id ?? `${providerId}:normalized`),
        providerId,
        supplier: providerId,
        vehicleClass: String(raw.vehicleClass ?? ''),
        pickupLocation: String(raw.pickupLocation ?? ''),
        dropoffLocation: String(raw.dropoffLocation ?? ''),
        total: { amount: Number((raw.total as { amount?: number } | undefined)?.amount ?? 0), currency: 'AUD' },
        isBookableLive: false,
      };
    },
    async getHealth() {
      return health(providerId, displayName, status, 'car hire');
    },
  };
}

export function createCarHirePlaceholderAdapter(status: SupplierStatus = 'enabled'): CarHireProvider {
  const providerId = 'car-hire-placeholder';
  const displayName = 'Car Hire (placeholder)';
  return {
    providerId,
    displayName,
    async search(request) {
      if (status !== 'enabled') {
        return { offers: [], meta: [], partial: false, warnings: [`${displayName} is ${status}`] };
      }
      const currency = request.currency ?? 'AUD';
      return {
        offers: buildMockCarHire(providerId, request.pickupLocation, request.dropoffLocation ?? request.pickupLocation, currency),
        meta: [{ providerId, displayName, mode: 'mock', searchedAt: new Date().toISOString(), isLiveInventory: false, warning: mockWarning() }],
        partial: false,
        warnings: [mockWarning()],
      };
    },
    normalize(raw) {
      return createMockCarHireProvider().normalize(raw);
    },
    async getHealth() {
      return health(providerId, displayName, status, 'car hire');
    },
  };
}

export function createMockCruiseProvider(status: SupplierStatus = 'enabled'): CruiseProvider {
  const providerId = 'mock-cruises';
  const displayName = 'Travel Buddy Mock Cruises';
  return {
    providerId,
    displayName,
    async search(request) {
      if (status !== 'enabled') {
        return { offers: [], meta: [], partial: false, warnings: [`${displayName} is ${status}`] };
      }
      const currency = request.currency ?? 'AUD';
      return {
        offers: buildMockCruises(providerId, request.region || request.departurePort || 'Coastal', currency),
        meta: [{ providerId, displayName, mode: 'mock', searchedAt: new Date().toISOString(), isLiveInventory: false, warning: mockWarning() }],
        partial: false,
        warnings: [mockWarning()],
      };
    },
    normalize(raw) {
      return {
        id: String(raw.id ?? `${providerId}:normalized`),
        providerId,
        line: String(raw.line ?? ''),
        ship: String(raw.ship ?? ''),
        itineraryName: String(raw.itineraryName ?? ''),
        departurePort: String(raw.departurePort ?? ''),
        nights: Number(raw.nights ?? 0),
        cabinType: String(raw.cabinType ?? ''),
        fareFrom: { amount: Number((raw.fareFrom as { amount?: number } | undefined)?.amount ?? 0), currency: 'AUD' },
        isBookableLive: false,
      };
    },
    async getHealth() {
      return health(providerId, displayName, status, 'cruise');
    },
  };
}

export function createCruisePlaceholderAdapter(status: SupplierStatus = 'enabled'): CruiseProvider {
  const providerId = 'cruise-placeholder';
  const displayName = 'Cruises (placeholder)';
  const base = createMockCruiseProvider(status);
  return {
    ...base,
    providerId,
    displayName,
    async search(request) {
      const result = await base.search(request);
      return {
        ...result,
        offers: result.offers.map((offer) => ({ ...offer, id: offer.id.replace('mock-cruises', providerId), providerId })),
        meta: result.meta.map((entry) => ({ ...entry, providerId, displayName })),
      };
    },
    async getHealth() {
      return health(providerId, displayName, status, 'cruise');
    },
  };
}

export function createMockTransferProvider(status: SupplierStatus = 'enabled'): TransferProvider {
  const providerId = 'mock-transfers';
  const displayName = 'Travel Buddy Mock Transfers';
  return {
    providerId,
    displayName,
    async search(request) {
      if (status !== 'enabled') {
        return { offers: [], meta: [], partial: false, warnings: [`${displayName} is ${status}`] };
      }
      const currency = request.currency ?? 'AUD';
      return {
        offers: buildMockTransfers(providerId, request.pickup, request.dropoff, currency),
        meta: [{ providerId, displayName, mode: 'mock', searchedAt: new Date().toISOString(), isLiveInventory: false, warning: mockWarning() }],
        partial: false,
        warnings: [mockWarning()],
      };
    },
    normalize(raw) {
      return {
        id: String(raw.id ?? `${providerId}:normalized`),
        providerId,
        supplier: providerId,
        vehicleType: String(raw.vehicleType ?? ''),
        pickup: String(raw.pickup ?? ''),
        dropoff: String(raw.dropoff ?? ''),
        total: { amount: Number((raw.total as { amount?: number } | undefined)?.amount ?? 0), currency: 'AUD' },
        isBookableLive: false,
      };
    },
    async getHealth() {
      return health(providerId, displayName, status, 'transfer');
    },
  };
}

export function createTransferPlaceholderAdapter(status: SupplierStatus = 'enabled'): TransferProvider {
  const providerId = 'transfer-placeholder';
  const displayName = 'Transfers (placeholder)';
  const base = createMockTransferProvider(status);
  return {
    ...base,
    providerId,
    displayName,
    async search(request) {
      const result = await base.search(request);
      return {
        ...result,
        offers: result.offers.map((offer) => ({ ...offer, id: offer.id.replace('mock-transfers', providerId), providerId, supplier: providerId })),
        meta: result.meta.map((entry) => ({ ...entry, providerId, displayName })),
      };
    },
    async getHealth() {
      return health(providerId, displayName, status, 'transfer');
    },
  };
}

export function createMockInsuranceProvider(status: SupplierStatus = 'enabled'): InsuranceProvider {
  const providerId = 'mock-insurance';
  const displayName = 'Travel Buddy Mock Insurance';
  return {
    providerId,
    displayName,
    async search(request) {
      if (status !== 'enabled') {
        return { offers: [], meta: [], partial: false, warnings: [`${displayName} is ${status}`] };
      }
      const currency = request.currency ?? 'AUD';
      return {
        offers: buildMockInsurance(providerId, request.destination, currency),
        meta: [{ providerId, displayName, mode: 'mock', searchedAt: new Date().toISOString(), isLiveInventory: false, warning: mockWarning() }],
        partial: false,
        warnings: [mockWarning()],
      };
    },
    normalize(raw) {
      return {
        id: String(raw.id ?? `${providerId}:normalized`),
        providerId,
        productName: String(raw.productName ?? ''),
        coverageSummary: String(raw.coverageSummary ?? ''),
        premium: { amount: Number((raw.premium as { amount?: number } | undefined)?.amount ?? 0), currency: 'AUD' },
        isBookableLive: false,
      };
    },
    async getHealth() {
      return health(providerId, displayName, status, 'insurance');
    },
  };
}

export function createMockRailProvider(status: SupplierStatus = 'enabled'): RailProvider {
  const providerId = 'mock-rail';
  const displayName = 'Travel Buddy Mock Rail';
  return {
    providerId,
    displayName,
    async search(request) {
      if (status !== 'enabled') {
        return { offers: [], meta: [], partial: false, warnings: [`${displayName} is ${status}`] };
      }
      const currency = request.currency ?? 'AUD';
      return {
        offers: buildMockRail(providerId, request.origin, request.destination, request.departDate, currency),
        meta: [{ providerId, displayName, mode: 'mock', searchedAt: new Date().toISOString(), isLiveInventory: false, warning: mockWarning() }],
        partial: false,
        warnings: [mockWarning()],
      };
    },
    normalize(raw) {
      return {
        id: String(raw.id ?? `${providerId}:normalized`),
        providerId,
        operator: String(raw.operator ?? ''),
        trainNumber: String(raw.trainNumber ?? ''),
        origin: String(raw.origin ?? ''),
        destination: String(raw.destination ?? ''),
        departAt: String(raw.departAt ?? ''),
        arriveAt: String(raw.arriveAt ?? ''),
        fare: { amount: Number((raw.fare as { amount?: number } | undefined)?.amount ?? 0), currency: 'AUD' },
        isBookableLive: false,
      };
    },
    async getHealth() {
      return health(providerId, displayName, status, 'rail');
    },
  };
}
