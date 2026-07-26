import { beforeEach, describe, expect, it } from 'vitest';
import { VAULT_STORAGE_KEY } from '../vaultDomain';
import { createLocalDataRepositories } from './localStorageProvider';
import { SUPABASE_ADAPTER_PLAN } from './types';

describe('localStorageProvider repositories', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists and saves trips through the local trip repository', async () => {
    const repos = createLocalDataRepositories();
    const listed = await repos.trips.list();
    expect(listed.length).toBeGreaterThanOrEqual(1);
    const trip = listed[0]!;
    const saved = await repos.trips.save({ ...trip, destination: 'Oslo' });
    expect(saved.ok).toBe(true);
    const reloaded = await repos.trips.getById(trip.id);
    expect(reloaded?.destination).toBe('Oslo');
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toContain('Oslo');
  });

  it('upserts bookings and documents via repository adapters', async () => {
    const repos = createLocalDataRepositories();
    const trip = (await repos.trips.list())[0]!;
    const booking = await repos.bookings.upsert(trip.id, {
      id: 'booking-repo-1',
      type: 'hotel',
      title: 'Repo Hotel',
      provider: 'Stay',
      confirmationNumber: 'R1',
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      startTime: '',
      endTime: '',
      location: 'City',
      cost: 120,
      currency: 'USD',
      status: 'confirmed',
      notes: '',
      link: '',
      attachmentName: '',
      attachmentMimeType: '',
    });
    expect(booking.ok).toBe(true);
    const document = await repos.documents.upsert(trip.id, {
      id: 'doc-repo-1',
      type: 'visa',
      title: 'Visa meta',
      holderName: 'A',
      documentNumberLast4: '2222',
      issuingCountry: 'NO',
      issueDate: '2026-01-01',
      expiryDate: '2026-12-01',
      notes: '',
      attachmentName: '',
      attachmentMimeType: '',
      storagePath: '',
    });
    expect(document.ok).toBe(true);
    expect((await repos.bookings.listByTrip(trip.id)).some((entry) => entry.title === 'Repo Hotel')).toBe(true);
    expect((await repos.documents.listByTrip(trip.id)).some((entry) => entry.title === 'Visa meta')).toBe(true);
  });

  it('documents the supabase adapter plan without connecting', () => {
    expect(SUPABASE_ADAPTER_PLAN.status).toBe('connected');
    expect(SUPABASE_ADAPTER_PLAN.remoteMigrationsApplied).toBe(true);
    expect(SUPABASE_ADAPTER_PLAN.interfaces).toContain('trips');
  });
});
