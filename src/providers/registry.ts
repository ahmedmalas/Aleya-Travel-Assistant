import {
  createAmadeusFlightAdapter,
  createDuffelFlightAdapter,
  createMockFlightProvider,
} from './adapters/flightAdapters';
import {
  createMockActivitiesProvider,
  createViatorActivitiesAdapter,
} from './adapters/activityAdapters';
import {
  createBookingComHotelAdapter,
  createExpediaRapidHotelAdapter,
  createHotelbedsHotelAdapter,
  createMockHotelProvider,
} from './adapters/hotelAdapters';
import {
  createCarHirePlaceholderAdapter,
  createCruisePlaceholderAdapter,
  createMockCarHireProvider,
  createMockCruiseProvider,
  createMockInsuranceProvider,
  createMockRailProvider,
  createMockTransferProvider,
  createTransferPlaceholderAdapter,
} from './adapters/placeholderAdapters';
import { loadSupplierConfig, type SupplierConfigMap, type TravelServiceKind } from './config/supplierConfig';
import type {
  ActivitiesProvider,
  CarHireProvider,
  CruiseProvider,
  FlightProvider,
  HotelProvider,
  InsuranceProvider,
  RailProvider,
  TransferProvider,
} from './interfaces/providers';
import type { SupplierStatus } from './types/common';

export type ProviderRegistry = {
  flights: FlightProvider[];
  hotels: HotelProvider[];
  activities: ActivitiesProvider[];
  carHire: CarHireProvider[];
  cruises: CruiseProvider[];
  transfers: TransferProvider[];
  insurance: InsuranceProvider[];
  rail: RailProvider[];
};

function statusOf(config: SupplierConfigMap, supplierId: string, fallback: SupplierStatus): SupplierStatus {
  return config[supplierId]?.status ?? fallback;
}

/** Build the full provider registry from config. Disabled/pending suppliers still exist but skip search. */
export function createProviderRegistry(config: SupplierConfigMap = loadSupplierConfig()): ProviderRegistry {
  return {
    flights: [
      createMockFlightProvider(statusOf(config, 'mock-flights', 'enabled')),
      createAmadeusFlightAdapter(statusOf(config, 'amadeus', 'enabled')),
      createDuffelFlightAdapter(statusOf(config, 'duffel', 'disabled')),
    ],
    hotels: [
      createMockHotelProvider(statusOf(config, 'mock-hotels', 'enabled')),
      createBookingComHotelAdapter(statusOf(config, 'booking-com', 'pending')),
      createExpediaRapidHotelAdapter(statusOf(config, 'expedia-rapid', 'disabled')),
      createHotelbedsHotelAdapter(statusOf(config, 'hotelbeds', 'disabled')),
    ],
    activities: [
      createMockActivitiesProvider(statusOf(config, 'mock-activities', 'enabled')),
      createViatorActivitiesAdapter(statusOf(config, 'viator', 'enabled')),
    ],
    carHire: [
      createMockCarHireProvider(statusOf(config, 'mock-car-hire', 'enabled')),
      createCarHirePlaceholderAdapter(statusOf(config, 'car-hire-placeholder', 'enabled')),
    ],
    cruises: [
      createMockCruiseProvider(statusOf(config, 'mock-cruises', 'enabled')),
      createCruisePlaceholderAdapter(statusOf(config, 'cruise-placeholder', 'enabled')),
    ],
    transfers: [
      createMockTransferProvider(statusOf(config, 'mock-transfers', 'enabled')),
      createTransferPlaceholderAdapter(statusOf(config, 'transfer-placeholder', 'enabled')),
    ],
    insurance: [createMockInsuranceProvider(statusOf(config, 'mock-insurance', 'enabled'))],
    rail: [createMockRailProvider(statusOf(config, 'mock-rail', 'enabled'))],
  };
}

let activeRegistry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!activeRegistry) activeRegistry = createProviderRegistry();
  return activeRegistry;
}

/** Test / runtime helper to rebuild registry after config changes. */
export function resetProviderRegistry(config?: SupplierConfigMap): ProviderRegistry {
  activeRegistry = createProviderRegistry(config ?? loadSupplierConfig());
  return activeRegistry;
}

export function providersFor(service: TravelServiceKind): ProviderRegistry[keyof ProviderRegistry] {
  const registry = getProviderRegistry();
  return registry[service];
}
