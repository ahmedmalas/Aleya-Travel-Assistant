import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripStore } from './useTripStore';
import { VAULT_STORAGE_KEY, TEMPLATE_STORAGE_KEY } from './vaultDomain';

const TRIP_KEY = 'travel-buddy:trip-state:v1';

describe('useTripStore vault slices 37-44', () => {
  beforeEach(() => {
    localStorage.clear();
    let counter = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
      () => `11111111-1111-4111-8111-${String(++counter).padStart(12, '0')}`,
    );
  });

  it('creates, favourites, duplicates, archives, and deletes vault trips', () => {
    const { result } = renderHook(() => useTripStore());
    expect(result.current.vault.trips.length).toBeGreaterThanOrEqual(1);

    act(() => {
      result.current.createVaultTripEntry({ tripName: 'Paris Weekend', destination: 'Paris', status: 'draft' });
    });
    const createdId = result.current.vault.activeTripId;
    expect(result.current.trip.tripName).toBe('Paris Weekend');

    act(() => {
      result.current.toggleVaultFavourite(createdId);
    });
    expect(result.current.vault.trips.find((trip) => trip.id === createdId)?.favourite).toBe(true);

    act(() => {
      const duplicated = result.current.duplicateVaultTrip(createdId);
      expect(duplicated.ok).toBe(true);
    });
    expect(result.current.vault.trips.some((trip) => trip.tripName.includes('(copy)'))).toBe(true);

    act(() => {
      result.current.archiveVaultTrip(createdId);
    });
    expect(result.current.vault.trips.find((trip) => trip.id === createdId)?.status).toBe('archived');

    const beforeDelete = result.current.vault.trips.length;
    act(() => {
      const deleted = result.current.deleteVaultTrip(result.current.vault.activeTripId);
      expect(deleted.ok).toBe(true);
    });
    expect(result.current.vault.trips.length).toBe(beforeDelete - 1);
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toContain('Paris');
  });

  it('saves templates and creates trips from templates', () => {
    const { result } = renderHook(() => useTripStore());
    act(() => {
      result.current.saveTripSetup({
        tripName: 'Source Trip',
        destination: 'Berlin',
        departureDate: '2026-10-01',
        returnDate: '2026-10-05',
        travellerCount: 1,
        purpose: 'business',
        budget: 900,
        currency: 'EUR',
        notes: '',
        status: 'active',
      });
      result.current.saveTripAsTemplate('Berlin template', 'From active trip');
    });
    expect(result.current.templates.some((template) => template.name === 'Berlin template')).toBe(true);
    expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).toContain('Berlin template');

    act(() => {
      const created = result.current.createTripFromTemplate(
        result.current.templates.find((template) => template.name === 'Berlin template')!.id,
        'Berlin from template',
      );
      expect(created.ok).toBe(true);
    });
    expect(result.current.trip.tripName).toBe('Berlin from template');
  });

  it('manages documents, collaboration, and global search', () => {
    const { result } = renderHook(() => useTripStore());
    act(() => {
      result.current.upsertDocument({
        id: 'doc-1',
        type: 'passport',
        title: 'Primary passport',
        holderName: 'Alex',
        documentNumberLast4: '4321',
        issuingCountry: 'US',
        issueDate: '2020-01-01',
        expiryDate: '2026-07-25',
        notes: '',
        attachmentName: 'passport.pdf',
        attachmentMimeType: 'application/pdf',
        storagePath: '',
      });
      result.current.inviteCollaborator({ name: 'Jamie', email: 'jamie@example.com', role: 'editor' });
      result.current.setGlobalSearchQuery('passport');
    });
    expect(result.current.activeVaultTrip.documents).toHaveLength(1);
    expect(result.current.documentExpiryReminders.length).toBeGreaterThan(0);
    expect(result.current.activeVaultTrip.collaboration.members.some((member) => member.name === 'Jamie')).toBe(true);
    expect(result.current.globalSearchResults.some((hit) => hit.entity === 'document')).toBe(true);
  });

  it('imports vault backups and reschedules calendar stops', () => {
    const { result } = renderHook(() => useTripStore());
    act(() => {
      result.current.addStop({
        title: 'Museum',
        date: '2026-09-01',
        startTime: '10:00',
        endTime: '12:00',
        location: 'City',
        category: 'sightseeing',
        cost: 20,
      });
    });
    const stopId = result.current.trip.stops.at(-1)!.id;
    act(() => {
      result.current.rescheduleStopDate(stopId, '2026-09-03');
    });
    expect(result.current.trip.stops.find((stop) => stop.id === stopId)?.date).toBe('2026-09-03');

    const vaultJson = result.current.toVaultBackupJson();
    act(() => {
      const imported = result.current.importVaultBackup(vaultJson, 'merge');
      expect(imported.ok).toBe(true);
    });
    expect(result.current.vault.trips.length).toBeGreaterThan(1);

    const tripBackup = result.current.toBackupJson();
    expect(tripBackup).toContain('"backupVersion": 7');
    expect(localStorage.getItem(TRIP_KEY)).toBeTruthy();
  });
});
