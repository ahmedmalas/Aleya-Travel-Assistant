import { afterEach, describe, expect, it } from 'vitest';
import {
  configureProvidersForTests,
  describeProviderArchitecture,
  listProviderHealth,
  loadSupplierConfig,
  resetProviderRegistry,
  searchActivities,
  searchCarHire,
  searchCruises,
  searchFlights,
  searchHotels,
  searchTransfers,
  withSupplierStatus,
} from './index';

afterEach(() => {
  resetProviderRegistry();
});

describe('travel provider gateway', () => {
  it('searches flights through provider interfaces and returns unified mock offers', async () => {
    const result = await searchFlights({
      origin: 'Sydney — Sydney Airport (SYD), Australia',
      destination: 'Tokyo — Narita International (NRT), Japan',
      departDate: '2026-09-10',
      travellers: 2,
      cabin: 'economy',
      currency: 'AUD',
    });
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers.every((offer) => offer.isBookableLive === false)).toBe(true);
    expect(result.offers.every((offer) => offer.bookingToken)).toBe(true);
    expect(result.offers.every((offer) => offer.fare.currency === 'AUD')).toBe(true);
    expect(result.meta.every((entry) => entry.isLiveInventory === false)).toBe(true);
    expect(result.warnings.some((warning) => /mock/i.test(warning))).toBe(true);
  });

  it('searches hotels through unified hotel models', async () => {
    const result = await searchHotels({
      destination: 'Melbourne',
      checkIn: '2026-09-10',
      checkOut: '2026-09-14',
      guests: 2,
      rooms: 1,
      currency: 'AUD',
    });
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers[0]).toMatchObject({
      property: expect.any(String),
      nightlyRate: expect.objectContaining({ amount: expect.any(Number) }),
      cancellationPolicy: expect.any(String),
      isBookableLive: false,
    });
  });

  it('supports activities, car hire, cruises, and transfers via mock providers', async () => {
    const [activities, cars, cruises, transfers] = await Promise.all([
      searchActivities({ destination: 'Tokyo', currency: 'AUD' }),
      searchCarHire({
        pickupLocation: 'Tokyo Airport',
        pickupDate: '2026-09-10',
        dropoffDate: '2026-09-14',
        currency: 'AUD',
      }),
      searchCruises({ region: 'Sydney', currency: 'AUD' }),
      searchTransfers({
        pickup: 'SYD',
        dropoff: 'Hotel',
        pickupDate: '2026-09-10',
        currency: 'AUD',
      }),
    ]);
    expect(activities.offers[0]?.category).toBeTruthy();
    expect(cars.offers[0]?.vehicleClass).toBeTruthy();
    expect(cruises.offers[0]?.ship).toBeTruthy();
    expect(transfers.offers[0]?.vehicleType).toBeTruthy();
  });

  it('switches providers via config without code changes', async () => {
    const base = loadSupplierConfig({
      VITE_TRAVEL_PROVIDER_AMADEUS: 'enabled',
      VITE_TRAVEL_PROVIDER_DUFFEL: 'disabled',
      VITE_TRAVEL_PROVIDER_MOCK_FLIGHTS: 'disabled',
    });
    configureProvidersForTests(base);
    const enabled = await searchFlights({
      origin: 'SYD',
      destination: 'NRT',
      departDate: '2026-10-01',
      travellers: 1,
    });
    expect(enabled.offers.every((offer) => offer.providerId === 'amadeus')).toBe(true);

    const disabledAmadeus = withSupplierStatus(base, 'amadeus', 'disabled');
    const onlyPending = withSupplierStatus(disabledAmadeus, 'duffel', 'enabled');
    configureProvidersForTests(onlyPending);
    const switched = await searchFlights({
      origin: 'SYD',
      destination: 'NRT',
      departDate: '2026-10-01',
      travellers: 1,
    });
    expect(switched.offers.every((offer) => offer.providerId === 'duffel')).toBe(true);
    expect(switched.offers.some((offer) => offer.providerId === 'amadeus')).toBe(false);
  });

  it('reports provider health and architecture metadata', async () => {
    const health = await listProviderHealth();
    expect(health.length).toBeGreaterThan(5);
    expect(health.some((entry) => entry.providerId === 'amadeus')).toBe(true);
    expect(health.some((entry) => entry.providerId === 'booking-com')).toBe(true);
    expect(health.some((entry) => entry.providerId === 'viator')).toBe(true);

    const architecture = describeProviderArchitecture();
    expect(architecture.principle).toMatch(/Provider Gateway/i);
    expect(architecture.services).toContain('flights');
    expect(architecture.privateEnvKeysDocumented).toContain('AMADEUS_CLIENT_SECRET');
    expect(architecture.liveProxyEnabled).toBe(false);
  });
});
