import { describe, expect, it, vi } from 'vitest';
import {
  hydrateVaultFromRepositories,
  persistVaultToRepositories,
  shouldAutoPersistToCloud,
} from './cloudPersistence';
import type { DataRepositories } from '../repositories/types';
import type { TripVaultState } from '../vaultDomain';

const sampleVault: TripVaultState = {
  version: 1,
  activeTripId: 't1',
  trips: [
    {
      id: 't1',
      tripName: 'Tokyo',
      status: 'draft',
      favourite: false,
      lastOpenedAt: '2026-07-19T00:00:00.000Z',
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
    } as TripVaultState['trips'][number],
  ],
};

describe('shouldAutoPersistToCloud', () => {
  it('requires configured supabase, signed-in auth, and applied migrations', () => {
    expect(
      shouldAutoPersistToCloud({
        supabaseConfigured: true,
        authMode: 'signed-in',
        remoteMigrationsApplied: true,
      }),
    ).toBe(true);
    expect(
      shouldAutoPersistToCloud({
        supabaseConfigured: true,
        authMode: 'signed-out',
        remoteMigrationsApplied: true,
      }),
    ).toBe(false);
  });
});

describe('persistVaultToRepositories', () => {
  it('delegates to trips.saveVault', async () => {
    const saveVault = vi.fn().mockResolvedValue({ ok: true, value: sampleVault });
    const repos = { trips: { saveVault } } as unknown as DataRepositories;
    const result = await persistVaultToRepositories(repos, sampleVault);
    expect(result.ok).toBe(true);
    expect(saveVault).toHaveBeenCalledWith(sampleVault);
  });
});

describe('hydrateVaultFromRepositories', () => {
  it('keeps local active trip when it exists remotely', async () => {
    const getVault = vi.fn().mockResolvedValue({
      version: 1,
      activeTripId: 't2',
      trips: [
        { ...sampleVault.trips[0], id: 't1' },
        { ...sampleVault.trips[0], id: 't2', tripName: 'Osaka' },
      ],
    });
    const repos = { trips: { getVault } } as unknown as DataRepositories;
    const next = await hydrateVaultFromRepositories(repos, sampleVault);
    expect(next.activeTripId).toBe('t1');
    expect(next.trips).toHaveLength(2);
  });
});
