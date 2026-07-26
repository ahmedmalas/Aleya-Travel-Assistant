/**
 * Travel Provider Gateway — the only surface the frontend should call for inventory.
 * Never import supplier SDKs or call supplier APIs from UI components.
 */

import { getProviderRegistry, resetProviderRegistry, type ProviderRegistry } from './registry';
import { loadSupplierConfig, type SupplierConfigMap, type TravelServiceKind } from './config/supplierConfig';
import { isLiveTravelProxyEnabled, loadTravelSecrets } from './config/secrets';
import type { ProviderHealth } from './types/common';
import type { ActivitySearchRequest, ActivitySearchResponse } from './types/activities';
import type { CarHireSearchRequest, CarHireSearchResponse } from './types/carHire';
import type { CruiseSearchRequest, CruiseSearchResponse } from './types/cruises';
import type { FlightSearchRequest, FlightSearchResponse } from './types/flights';
import type { HotelSearchRequest, HotelSearchResponse } from './types/hotels';
import type { InsuranceSearchRequest, InsuranceSearchResponse } from './types/insurance';
import type { RailSearchRequest, RailSearchResponse } from './types/rail';
import type { TransferSearchRequest, TransferSearchResponse } from './types/transfers';

async function fanOutSearch<TOffer, TResponse extends { offers: TOffer[]; meta: unknown[]; warnings: string[]; partial: boolean }>(
  searches: Array<Promise<TResponse>>,
): Promise<TResponse> {
  const results = await Promise.all(searches);
  const offers = results.flatMap((result) => result.offers);
  const meta = results.flatMap((result) => result.meta);
  const warnings = Array.from(new Set(results.flatMap((result) => result.warnings)));
  if (isLiveTravelProxyEnabled()) {
    warnings.push('Live proxy flag is on, but no live supplier adapters are approved yet — still mock-only.');
  }
  return {
    offers,
    meta,
    warnings,
    partial: results.some((result) => result.partial),
  } as TResponse;
}

export async function searchFlights(request: FlightSearchRequest): Promise<FlightSearchResponse> {
  const providers = getProviderRegistry().flights;
  return fanOutSearch(providers.map((provider) => provider.search(request)));
}

export async function searchHotels(request: HotelSearchRequest): Promise<HotelSearchResponse> {
  const providers = getProviderRegistry().hotels;
  return fanOutSearch(providers.map((provider) => provider.search(request)));
}

export async function searchActivities(request: ActivitySearchRequest): Promise<ActivitySearchResponse> {
  const providers = getProviderRegistry().activities;
  return fanOutSearch(providers.map((provider) => provider.search(request)));
}

export async function searchCarHire(request: CarHireSearchRequest): Promise<CarHireSearchResponse> {
  const providers = getProviderRegistry().carHire;
  return fanOutSearch(providers.map((provider) => provider.search(request)));
}

export async function searchCruises(request: CruiseSearchRequest): Promise<CruiseSearchResponse> {
  const providers = getProviderRegistry().cruises;
  return fanOutSearch(providers.map((provider) => provider.search(request)));
}

export async function searchTransfers(request: TransferSearchRequest): Promise<TransferSearchResponse> {
  const providers = getProviderRegistry().transfers;
  return fanOutSearch(providers.map((provider) => provider.search(request)));
}

export async function searchInsurance(request: InsuranceSearchRequest): Promise<InsuranceSearchResponse> {
  const providers = getProviderRegistry().insurance;
  return fanOutSearch(providers.map((provider) => provider.search(request)));
}

export async function searchRail(request: RailSearchRequest): Promise<RailSearchResponse> {
  const providers = getProviderRegistry().rail;
  return fanOutSearch(providers.map((provider) => provider.search(request)));
}

export async function listProviderHealth(): Promise<ProviderHealth[]> {
  const registry = getProviderRegistry();
  const groups = Object.values(registry) as Array<Array<{ getHealth: () => Promise<ProviderHealth> }>>;
  const health = await Promise.all(groups.flatMap((group) => group.map((provider) => provider.getHealth())));
  return health;
}

export function describeProviderArchitecture(): {
  principle: string;
  services: TravelServiceKind[];
  liveProxyEnabled: boolean;
  secretPublicKeysConfigured: string[];
  privateEnvKeysDocumented: readonly string[];
  suppliers: Array<{ supplierId: string; service: TravelServiceKind; status: string; displayName: string }>;
} {
  const config = loadSupplierConfig();
  const secrets = loadTravelSecrets();
  const publicConfigured = Object.entries(secrets.public)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  return {
    principle: 'UI → Provider Gateway → Provider interfaces → Supplier adapters (mock until approved)',
    services: ['flights', 'hotels', 'activities', 'carHire', 'cruises', 'transfers', 'insurance', 'rail'],
    liveProxyEnabled: isLiveTravelProxyEnabled(),
    secretPublicKeysConfigured: publicConfigured,
    privateEnvKeysDocumented: secrets.privateEnvKeys,
    suppliers: Object.values(config).map((entry) => ({
      supplierId: entry.supplierId,
      service: entry.service,
      status: entry.status,
      displayName: entry.displayName,
    })),
  };
}

export function configureProvidersForTests(config: SupplierConfigMap): ProviderRegistry {
  return resetProviderRegistry(config);
}

export { loadSupplierConfig, resetProviderRegistry, getProviderRegistry };
