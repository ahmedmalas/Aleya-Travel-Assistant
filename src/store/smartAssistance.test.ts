import { describe, expect, it } from 'vitest';
import { createEmptyTrip } from './tripDomain';
import {
  buildSmartAssistance,
  detectMissingAccommodationNights,
  detectOverlappingBookings,
  suggestFreeTimeBlocks,
} from './smartAssistance';

describe('smartAssistance', () => {
  it('detects overlapping bookings', () => {
    const suggestions = detectOverlappingBookings([
      {
        id: 'b1',
        type: 'activity',
        title: 'Museum',
        provider: '',
        confirmationNumber: '',
        startDate: '2026-09-01',
        startTime: '10:00',
        endDate: '2026-09-01',
        endTime: '12:00',
        location: '',
        cost: 0,
        currency: 'USD',
        status: 'confirmed',
        notes: '',
        link: '',
        attachmentName: '',
        attachmentMimeType: '',
      },
      {
        id: 'b2',
        type: 'activity',
        title: 'Lunch tour',
        provider: '',
        confirmationNumber: '',
        startDate: '2026-09-01',
        startTime: '11:00',
        endDate: '2026-09-01',
        endTime: '13:00',
        location: '',
        cost: 0,
        currency: 'USD',
        status: 'confirmed',
        notes: '',
        link: '',
        attachmentName: '',
        attachmentMimeType: '',
      },
    ]);
    expect(suggestions.some((item) => item.kind === 'overlapping-booking')).toBe(true);
  });

  it('detects missing accommodation nights', () => {
    const suggestions = detectMissingAccommodationNights('2026-09-01', '2026-09-04', [
      {
        id: 's1',
        type: 'hotel',
        name: 'One night',
        address: '',
        contactPhone: '',
        contactEmail: '',
        checkInDate: '2026-09-01',
        checkInTime: '15:00',
        checkOutDate: '2026-09-02',
        checkOutTime: '11:00',
        roomInfo: '',
        confirmationNumber: '',
        cost: 100,
        currency: 'USD',
        paymentStatus: 'paid',
        amenities: '',
        notes: '',
        itineraryStopId: null,
        travellerIds: [],
      },
    ]);
    expect(suggestions[0]?.kind).toBe('missing-accommodation');
    expect(suggestions[0]?.detail).toMatch(/2 night/);
  });

  it('suggests free time blocks and builds combined assistance', () => {
    const trip = createEmptyTrip({
      departureDate: '2026-09-01',
      returnDate: '2026-09-03',
      stops: [
        {
          id: 'a',
          title: 'Morning',
          day: 1,
          order: 0,
          notes: '',
          date: '2026-09-01',
          startTime: '09:00',
          endTime: '10:00',
          location: '',
          category: 'activity',
          cost: 0,
          currency: 'USD',
          bookingReference: '',

          locked: false,
          travellerIds: [],
          itemStatus: 'planned' as const,
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: false,
        },
        {
          id: 'b',
          title: 'Evening',
          day: 1,
          order: 1,
          notes: '',
          date: '2026-09-01',
          startTime: '16:00',
          endTime: '18:00',
          location: '',
          category: 'food',
          cost: 0,
          currency: 'USD',
          bookingReference: '',

          locked: false,
          travellerIds: [],
          itemStatus: 'planned' as const,
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: false,
        },
      ],
    });
    expect(suggestFreeTimeBlocks(trip.stops).some((item) => item.kind === 'free-time')).toBe(true);
    expect(buildSmartAssistance(trip).length).toBeGreaterThan(0);
  });
});
