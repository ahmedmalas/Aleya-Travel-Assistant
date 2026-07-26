import { describe, expect, it } from 'vitest';
import { createEmptyTrip } from './tripDomain';
import {
  detectDepartureCheckInConflicts,
  detectExcessiveTravel,
  suggestChecklistDeadlines,
} from './smartAssistance';

describe('smartAssistance edge rules', () => {
  it('flags excessive travel blocks and checklist deadlines', () => {
    const excessive = detectExcessiveTravel([
      {
        id: 't0',
        title: 'Arrive',
        day: 1,
        order: 0,
        notes: '',
        date: '2026-09-01',
        startTime: '06:00',
        endTime: '07:00',
        location: 'Hotel',
        category: 'lodging',
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
        id: 't1',
        title: 'Long transfer',
        day: 1,
        order: 1,
        notes: '',
        date: '2026-09-01',
        startTime: '08:00',
        endTime: '12:00',
        location: 'Airport',
        category: 'travel',
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
    ]);
    expect(excessive.some((item) => item.kind === 'excessive-travel')).toBe(true);

    const checklist = suggestChecklistDeadlines(
      '2026-09-10',
      [
        {
          id: 'c1',
          title: 'Visa form',
          category: 'visa',
          deadline: '2026-01-01',
          ownerName: 'Sam',
          completed: false,
          notes: '',
        },
      ],
      '2026-07-01',
    );
    expect(checklist.some((item) => item.kind === 'checklist-deadline')).toBe(true);
  });

  it('detects departure vs check-out conflicts', () => {
    const suggestions = detectDepartureCheckInConflicts(
      [
        {
          id: 'f1',
          airline: 'ANA',
          flightNumber: 'NH1',
          bookingReference: '',
          departureAirport: 'HND',
          arrivalAirport: 'KIX',
          departureTerminal: '',
          arrivalTerminal: '',
          departureGate: '',
          arrivalGate: '',
          departureDate: '2026-09-02',
          departureTime: '10:00',
          arrivalDate: '2026-09-02',
          arrivalTime: '11:30',
          layoverMinutes: 0,
          cabin: '',
          seat: '',
          baggageAllowance: '',
          checkInStatus: 'open',
          statusNotes: '',
          travellerIds: [],
          cost: 0,
          currency: 'USD',
          notes: '',
        },
      ],
      [
        {
          id: 'h1',
          type: 'hotel',
          name: 'Late checkout hotel',
          address: '',
          contactPhone: '',
          contactEmail: '',
          checkInDate: '2026-09-01',
          checkInTime: '15:00',
          checkOutDate: '2026-09-02',
          checkOutTime: '09:30',
          roomInfo: '',
          confirmationNumber: '',
          cost: 0,
          currency: 'USD',
          paymentStatus: 'paid',
          amenities: '',
          notes: '',
          itineraryStopId: null,
          travellerIds: [],
        },
      ],
      [],
    );
    expect(suggestions.some((item) => item.kind === 'departure-checkin-conflict')).toBe(true);
    expect(createEmptyTrip().flights).toEqual([]);
  });
});
