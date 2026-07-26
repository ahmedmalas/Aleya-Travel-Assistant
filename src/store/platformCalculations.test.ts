import { describe, expect, it } from 'vitest';
import { createEmptyTrip, createSeededTrip } from './tripDomain';
import {
  buildTripOverview,
  calculateBudgetSummary,
  calculatePackingProgress,
  detectItineraryConflicts,
  summarizeItineraryByDay,
} from './platformCalculations';

describe('platformCalculations', () => {
  it('calculates budget remaining and over-budget state', () => {
    const trip = createEmptyTrip({
      budget: 100,
      currency: 'USD',
      expenses: [
        {
          id: 'e1',
          title: 'Lunch',
          category: 'food',
          amount: 40,
          currency: 'USD',
          date: '2026-07-01',
          paid: true,
          notes: '',

          deposit: 0,
          refund: 0,
          sharedTravellerIds: [],
          exchangeRateToTrip: 1,
          attachmentName: '',
        },
        {
          id: 'e2',
          title: 'Museum',
          category: 'activities',
          amount: 70,
          currency: 'USD',
          date: '2026-07-01',
          paid: false,
          notes: '',

          deposit: 0,
          refund: 0,
          sharedTravellerIds: [],
          exchangeRateToTrip: 1,
          attachmentName: '',
        },
      ],
    });
    const summary = calculateBudgetSummary(trip);
    expect(summary.actualSpending).toBe(110);
    expect(summary.paidSpending).toBe(40);
    expect(summary.remainingBalance).toBe(-10);
    expect(summary.overBudget).toBe(true);
    expect(summary.categoryBreakdown).toHaveLength(2);
  });

  it('detects overlapping itinerary items on the same date', () => {
    const conflicts = detectItineraryConflicts([
      {
        id: 'a',
        title: 'Morning museum',
        day: 1,
        order: 1,
        notes: '',
        date: '2026-07-01',
        startTime: '09:00',
        endTime: '11:00',
        location: 'Museum',
        category: 'sightseeing',
        cost: 20,
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
        title: 'Brunch',
        day: 1,
        order: 2,
        notes: '',
        date: '2026-07-01',
        startTime: '10:30',
        endTime: '12:00',
        location: 'Cafe',
        category: 'food',
        cost: 30,
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
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.message).toMatch(/overlaps/i);
  });

  it('groups itinerary by day and computes packing progress', () => {
    const trip = createSeededTrip();
    const days = summarizeItineraryByDay(trip.stops);
    expect(days.length).toBeGreaterThan(0);
    expect(days[0]?.items.length).toBeGreaterThan(0);

    trip.packingLists[0]!.items = [
      {
        id: 'p1',
        name: 'Shirt',
        category: 'clothing',
        customCategory: '',
        quantity: 1,
        packed: true,
        assignedTravellerId: null,
      },
      {
        id: 'p2',
        name: 'Socks',
        category: 'clothing',
        customCategory: '',
        quantity: 2,
        packed: false,
        assignedTravellerId: null,
      },
    ];
    expect(calculatePackingProgress(trip.packingLists).progressPercent).toBe(50);

    const overview = buildTripOverview(trip, new Date('2026-08-01T00:00:00.000Z'));
    expect(overview.destination).toBe('Tokyo, Japan');
    expect(overview.daysUntilDeparture).toBe(31);
    expect(overview.itineraryItemCount).toBe(3);
  });
});
