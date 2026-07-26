import type { ProviderMode, SupplierStatus } from '../types/common';

export type TravelServiceKind =
  | 'flights'
  | 'hotels'
  | 'activities'
  | 'carHire'
  | 'cruises'
  | 'transfers'
  | 'insurance'
  | 'rail';

export type SupplierConfigEntry = {
  supplierId: string;
  displayName: string;
  service: TravelServiceKind;
  status: SupplierStatus;
  /** Live mode is never activated from the client without an approved proxy flag. */
  preferredMode: ProviderMode;
};

export type SupplierConfigMap = Record<string, SupplierConfigEntry>;

const DEFAULT_SUPPLIERS: SupplierConfigEntry[] = [
  { supplierId: 'mock-flights', displayName: 'Travel Buddy Mock Flights', service: 'flights', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'amadeus', displayName: 'Amadeus', service: 'flights', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'duffel', displayName: 'Duffel', service: 'flights', status: 'disabled', preferredMode: 'mock' },
  { supplierId: 'mock-hotels', displayName: 'Travel Buddy Mock Hotels', service: 'hotels', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'booking-com', displayName: 'Booking.com', service: 'hotels', status: 'pending', preferredMode: 'mock' },
  { supplierId: 'expedia-rapid', displayName: 'Expedia Rapid', service: 'hotels', status: 'disabled', preferredMode: 'mock' },
  { supplierId: 'hotelbeds', displayName: 'Hotelbeds', service: 'hotels', status: 'disabled', preferredMode: 'mock' },
  { supplierId: 'mock-activities', displayName: 'Travel Buddy Mock Activities', service: 'activities', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'viator', displayName: 'Viator', service: 'activities', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'mock-car-hire', displayName: 'Travel Buddy Mock Car Hire', service: 'carHire', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'car-hire-placeholder', displayName: 'Car Hire (placeholder)', service: 'carHire', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'mock-cruises', displayName: 'Travel Buddy Mock Cruises', service: 'cruises', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'cruise-placeholder', displayName: 'Cruises (placeholder)', service: 'cruises', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'mock-transfers', displayName: 'Travel Buddy Mock Transfers', service: 'transfers', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'transfer-placeholder', displayName: 'Transfers (placeholder)', service: 'transfers', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'mock-insurance', displayName: 'Travel Buddy Mock Insurance', service: 'insurance', status: 'enabled', preferredMode: 'mock' },
  { supplierId: 'mock-rail', displayName: 'Travel Buddy Mock Rail', service: 'rail', status: 'enabled', preferredMode: 'mock' },
];

function parseStatus(raw: string | undefined, fallback: SupplierStatus): SupplierStatus {
  const value = raw?.trim().toLowerCase();
  if (value === 'enabled' || value === 'disabled' || value === 'pending') return value;
  return fallback;
}

/**
 * Env overrides (no code change to switch providers):
 * VITE_TRAVEL_PROVIDER_<SUPPLIER_ID>=enabled|disabled|pending
 * Example: VITE_TRAVEL_PROVIDER_AMADEUS=disabled
 *          VITE_TRAVEL_PROVIDER_DUFFEL=enabled
 *          VITE_TRAVEL_PROVIDER_BOOKING_COM=pending
 */
export function loadSupplierConfig(
  env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>,
): SupplierConfigMap {
  const map: SupplierConfigMap = {};
  for (const entry of DEFAULT_SUPPLIERS) {
    const envKey = `VITE_TRAVEL_PROVIDER_${entry.supplierId.replace(/-/g, '_').toUpperCase()}`;
    map[entry.supplierId] = {
      ...entry,
      status: parseStatus(env[envKey], entry.status),
    };
  }
  return map;
}

export function listSuppliersForService(
  service: TravelServiceKind,
  config: SupplierConfigMap = loadSupplierConfig(),
): SupplierConfigEntry[] {
  return Object.values(config).filter((entry) => entry.service === service);
}

export function listEnabledSuppliers(
  service: TravelServiceKind,
  config: SupplierConfigMap = loadSupplierConfig(),
): SupplierConfigEntry[] {
  return listSuppliersForService(service, config).filter((entry) => entry.status === 'enabled');
}

/** Test helper — override a single supplier status without mutating defaults permanently. */
export function withSupplierStatus(
  config: SupplierConfigMap,
  supplierId: string,
  status: SupplierStatus,
): SupplierConfigMap {
  const current = config[supplierId];
  if (!current) return config;
  return { ...config, [supplierId]: { ...current, status } };
}
