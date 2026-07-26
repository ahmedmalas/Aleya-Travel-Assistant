import { describe, expect, it } from 'vitest';
import { createAmadeusFlightAdapter, createDuffelFlightAdapter } from './flightAdapters';
import {
  createBookingComHotelAdapter,
  createExpediaRapidHotelAdapter,
  createHotelbedsHotelAdapter,
} from './hotelAdapters';
import { createViatorActivitiesAdapter } from './activityAdapters';
import {
  createCarHirePlaceholderAdapter,
  createCruisePlaceholderAdapter,
  createTransferPlaceholderAdapter,
} from './placeholderAdapters';

describe('supplier adapters implement provider interfaces', () => {
  it('normalises flight supplier payloads into the unified flight model', async () => {
    const amadeus = createAmadeusFlightAdapter('enabled');
    const duffel = createDuffelFlightAdapter('enabled');
    const normalized = amadeus.normalize({
      id: 'raw-1',
      airline: 'Qantas',
      flightNumber: 'QF1',
      origin: 'Sydney',
      originCode: 'SYD',
      destination: 'London',
      destCode: 'LHR',
      departAt: '2026-11-01T10:00:00',
      arriveAt: '2026-11-02T05:00:00',
      durationMinutes: 1400,
      stops: 0,
      baggage: '2 bags',
      fare: { amount: 2100, currency: 'AUD' },
      cabin: 'business',
      bookingToken: 'token-x',
    });
    expect(normalized).toMatchObject({
      airline: 'Qantas',
      flightNumber: 'QF1',
      bookingToken: 'token-x',
      isBookableLive: false,
      fare: { amount: 2100, currency: 'AUD' },
    });
    const search = await duffel.search({
      origin: 'SYD',
      destination: 'MEL',
      departDate: '2026-12-01',
      travellers: 1,
    });
    expect(search.offers[0]?.providerId).toBe('duffel');
  });

  it('exposes hotel adapters for Booking.com, Expedia Rapid, and Hotelbeds', async () => {
    const booking = createBookingComHotelAdapter('enabled');
    const expedia = createExpediaRapidHotelAdapter('enabled');
    const hotelbeds = createHotelbedsHotelAdapter('enabled');
    const results = await Promise.all([
      booking.search({ destination: 'Paris', checkIn: '2026-08-01', checkOut: '2026-08-05', guests: 2 }),
      expedia.search({ destination: 'Paris', checkIn: '2026-08-01', checkOut: '2026-08-05', guests: 2 }),
      hotelbeds.search({ destination: 'Paris', checkIn: '2026-08-01', checkOut: '2026-08-05', guests: 2 }),
    ]);
    expect(results.map((result) => result.offers[0]?.providerId)).toEqual([
      'booking-com',
      'expedia-rapid',
      'hotelbeds',
    ]);
  });

  it('keeps Viator and placeholders operational on mock data', async () => {
    const viator = createViatorActivitiesAdapter('enabled');
    const car = createCarHirePlaceholderAdapter('enabled');
    const cruise = createCruisePlaceholderAdapter('enabled');
    const transfer = createTransferPlaceholderAdapter('enabled');
    const [activities, cars, cruises, transfers] = await Promise.all([
      viator.search({ destination: 'Rome' }),
      car.search({ pickupLocation: 'Rome', pickupDate: '2026-07-01', dropoffDate: '2026-07-04' }),
      cruise.search({ region: 'Mediterranean' }),
      transfer.search({ pickup: 'FCO', dropoff: 'Centro', pickupDate: '2026-07-01' }),
    ]);
    expect(activities.offers[0]?.providerId).toBe('viator');
    expect(cars.offers[0]?.providerId).toBe('car-hire-placeholder');
    expect(cruises.offers[0]?.providerId).toBe('cruise-placeholder');
    expect(transfers.offers[0]?.providerId).toBe('transfer-placeholder');
  });

  it('skips disabled adapters without throwing', async () => {
    const disabled = createAmadeusFlightAdapter('disabled');
    const result = await disabled.search({
      origin: 'SYD',
      destination: 'AKL',
      departDate: '2026-09-01',
      travellers: 1,
    });
    expect(result.offers).toEqual([]);
    expect(result.warnings[0]).toMatch(/disabled/i);
    const health = await disabled.getHealth();
    expect(health.status).toBe('not_configured');
  });
});
