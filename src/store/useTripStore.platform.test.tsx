import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripStore } from './useTripStore';

const TRIP_KEY = 'travel-buddy:trip-state:v1';
const SNAPSHOT_KEY = 'travel-buddy:trip-snapshots:v1';

describe('useTripStore platform slices 29-36', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
  });

  it('creates and persists a validated trip setup', () => {
    const { result, unmount } = renderHook(() => useTripStore());
    act(() => {
      const saved = result.current.saveTripSetup({
        tripName: 'Lisbon Escape',
        destination: 'Lisbon',
        departureDate: '2026-08-01',
        returnDate: '2026-08-08',
        travellerCount: 2,
        purpose: 'leisure',
        budget: 1800,
        currency: 'EUR',
        notes: 'Pastel de nata',
        status: 'active',
      });
      expect(saved.ok).toBe(true);
    });
    expect(result.current.trip.destination).toBe('Lisbon');
    expect(result.current.trip.budget).toBe(1800);
    const persisted = localStorage.getItem(TRIP_KEY);
    expect(persisted).toContain('Lisbon Escape');
    unmount();
    const rehydrated = renderHook(() => useTripStore());
    expect(rehydrated.result.current.trip.destination).toBe('Lisbon');
  });

  it('rejects invalid trip setup without mutating destination', () => {
    const { result } = renderHook(() => useTripStore());
    const before = result.current.trip.destination;
    act(() => {
      const saved = result.current.saveTripSetup({
        tripName: '',
        destination: '',
        departureDate: 'bad',
        returnDate: 'bad',
        travellerCount: 0,
        purpose: 'leisure',
        budget: -1,
        currency: '',
        notes: '',
      });
      expect(saved.ok).toBe(false);
      expect(saved.errors.tripName).toBeTruthy();
    });
    expect(result.current.trip.destination).toBe(before);
  });

  it('supports itinerary CRUD, booking, budget, packing, and traveller flows', () => {
    const { result } = renderHook(() => useTripStore());
    act(() => {
      result.current.startNewTripDraft();
      result.current.saveTripSetup({
        tripName: 'Test Trip',
        destination: 'Rome',
        departureDate: '2026-09-01',
        returnDate: '2026-09-05',
        travellerCount: 1,
        purpose: 'family',
        budget: 500,
        currency: 'USD',
        notes: '',
        status: 'active',
      });
    });

    act(() => {
      result.current.addStop({
        title: 'Colosseum',
        date: '2026-09-01',
        startTime: '10:00',
        endTime: '12:00',
        location: 'Rome',
        category: 'sightseeing',
        cost: 25,
      });
      result.current.addStop({
        title: 'Lunch',
        date: '2026-09-01',
        startTime: '11:30',
        endTime: '13:00',
        location: 'Trastevere',
        category: 'food',
        cost: 40,
      });
    });
    expect(result.current.trip.stops.length).toBe(2);
    expect(result.current.itineraryConflicts.length).toBe(1);

    const stopId = result.current.trip.stops[0]!.id;
    act(() => {
      result.current.updateStopDetails(stopId, { title: 'Colosseum tour' });
      result.current.duplicateStop(stopId);
    });
    expect(result.current.trip.stops.some((stop) => stop.title.includes('copy'))).toBe(true);

    act(() => {
      result.current.upsertBooking({
        id: 'booking-1',
        type: 'hotel',
        title: 'City Hotel',
        provider: 'StayCo',
        confirmationNumber: 'ABC',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        startTime: '15:00',
        endTime: '11:00',
        location: 'Rome',
        cost: 400,
        currency: 'USD',
        status: 'confirmed',
        notes: '',
        link: '',
        attachmentName: 'confirm.pdf',
        attachmentMimeType: 'application/pdf',
      });
      result.current.upsertExpense({
        id: 'expense-1',
        title: 'Gelato',
        category: 'food',
        amount: 12,
        currency: 'USD',
        date: '2026-09-01',
        paid: true,
        notes: '',

        deposit: 0,
        refund: 0,
        sharedTravellerIds: [],
        exchangeRateToTrip: 1,
        attachmentName: '',
      });
      result.current.updatePlannedBudget(450);
      result.current.upsertTraveller({
        id: 'trav-1',
        name: 'Jamie',
        dateOfBirth: '1991-02-02',
        nationality: 'US',
        dietaryRequirements: 'Vegetarian',
        accessibilityNeeds: '',
        emergencyContactName: 'Pat',
        emergencyContactPhone: '555',
        loyaltyPrograms: 'SkyMiles',
        passportNumberLast4: '1234',
        passportExpiry: '2030-01-01',
        passportCountry: 'US',

        preferredName: '',
        countryOfResidence: '',
        homeAirport: '',
        preferredDepartureAirports: '',
        language: 'en',
        currency: 'USD',
        timeZone: '',
        travelPreferences: '',
        seatingPreference: '',
        cabinPreference: '',
        hotelPreferences: '',
        loyaltyMemberships: [],
        companions: [],
        identityDocumentType: '',
        identityDocumentExpiry: '',
      });
      const listId = result.current.trip.packingLists[0]!.id;
      result.current.upsertPackingItem(listId, {
        id: 'pack-1',
        name: 'Jacket',
        category: 'clothing',
        customCategory: '',
        quantity: 1,
        packed: false,
        assignedTravellerId: 'trav-1',
      });
      result.current.upsertPackingItem(listId, {
        id: 'pack-1',
        name: 'Jacket',
        category: 'clothing',
        customCategory: '',
        quantity: 1,
        packed: true,
        assignedTravellerId: 'trav-1',
      });
    });

    expect(result.current.trip.bookings).toHaveLength(1);
    expect(result.current.budgetSummary.actualSpending).toBe(12);
    expect(result.current.budgetSummary.plannedBudget).toBe(450);
    expect(result.current.packingProgress.progressPercent).toBe(100);
    expect(result.current.trip.travellers[0]?.passportNumberLast4).toBe('1234');
    expect(result.current.tripOverview.bookingCount).toBe(1);
  });

  it('exports and imports v4 backups including platform fields, and migrates v2', () => {
    const { result } = renderHook(() => useTripStore());
    act(() => {
      result.current.startNewTripDraft();
      result.current.saveTripSetup({
        tripName: 'Backup Trip',
        destination: 'Oslo',
        departureDate: '2026-10-01',
        returnDate: '2026-10-05',
        travellerCount: 1,
        purpose: 'business',
        budget: 900,
        currency: 'NOK',
        notes: '',
        status: 'active',
      });
      result.current.upsertBooking({
        id: 'b-export',
        type: 'flight',
        title: 'Flight',
        provider: 'Air',
        confirmationNumber: 'Z1',
        startDate: '2026-10-01',
        endDate: '2026-10-01',
        startTime: '08:00',
        endTime: '10:00',
        location: 'OSL',
        cost: 300,
        currency: 'NOK',
        status: 'confirmed',
        notes: '',
        link: '',
        attachmentName: '',
        attachmentMimeType: '',
      });
    });

    const backupJson = result.current.toBackupJson();
    expect(backupJson).toContain('"backupVersion": 7');
    expect(backupJson).toContain('Oslo');

    act(() => {
      result.current.startNewTripDraft();
    });
    expect(result.current.trip.destination).toBe('');

    act(() => {
      const parsed = result.current.parseTripBackupPreview(backupJson);
      result.current.importTrip(parsed.trip);
    });
    expect(result.current.trip.destination).toBe('Oslo');
    expect(result.current.trip.bookings).toHaveLength(1);

    const legacyV2 = {
      schema: 'travel-buddy-backup',
      backupVersion: 2,
      applicationVersion: '0.1.0',
      exportedAt: '2026-01-01T00:00:00.000Z',
      tripTitle: 'Legacy V2',
      trip: {
        tripName: 'Legacy V2',
        stops: [{ id: 's1', title: 'Stop', day: 1, order: 1, notes: 'n' }],
      },
    };
    act(() => {
      const parsed = result.current.parseTripBackupPreview(JSON.stringify(legacyV2));
      result.current.importTrip(parsed.trip);
    });
    expect(result.current.trip.tripName).toBe('Legacy V2');
    expect(result.current.trip.packingLists.length).toBeGreaterThan(0);
    expect(localStorage.getItem(SNAPSHOT_KEY)).not.toBeNull();
  });

  it('keeps integrity audit and repair simulation compatible with platform data', () => {
    const { result } = renderHook(() => useTripStore());
    act(() => {
      result.current.runIntegrityAudit();
    });
    act(() => {
      result.current.simulateSelectedRepairs([]);
    });
    act(() => {
      result.current.applyIntegrityRepairs([]);
    });
    act(() => {
      result.current.runIntegrityDiagnostics();
    });
    expect(result.current.integrityAuditRuns.length).toBeGreaterThan(0);
    expect(result.current.lastIntegritySimulationAccuracy?.status).toBe('Exact Match');
    expect(result.current.integrityDiagnosticsSummary?.overallStatus).toBeTruthy();
  });
});
