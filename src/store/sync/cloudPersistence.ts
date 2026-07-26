import type { DataRepositories } from '../repositories/types';
import type { TripVaultState, VaultTrip } from '../vaultDomain';

export type CloudPersistResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Push the in-memory vault to the active repository provider.
 * Local provider writes localStorage; Supabase provider upserts trips when authenticated.
 */
export async function persistVaultToRepositories(
  repositories: DataRepositories,
  vault: TripVaultState,
): Promise<CloudPersistResult> {
  const result = await repositories.trips.saveVault(vault);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, message: `Persisted ${vault.trips.length} trip(s).` };
}

export async function persistActiveTripToRepositories(
  repositories: DataRepositories,
  trip: VaultTrip,
): Promise<CloudPersistResult> {
  const result = await repositories.trips.save(trip);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, message: `Persisted trip ${trip.tripName || trip.id}.` };
}

/**
 * Load vault from repositories and prefer remote trips when present.
 * Keeps the local activeTripId when it still exists remotely.
 */
export async function hydrateVaultFromRepositories(
  repositories: DataRepositories,
  localVault: TripVaultState,
): Promise<TripVaultState> {
  const remote = await repositories.trips.getVault();
  if (!remote.trips.length) return localVault;

  const remoteIds = new Set(remote.trips.map((trip) => trip.id));
  const activeTripId =
    localVault.activeTripId && remoteIds.has(localVault.activeTripId)
      ? localVault.activeTripId
      : remote.activeTripId || remote.trips[0]!.id;

  return {
    version: 1,
    activeTripId,
    trips: remote.trips,
  };
}

export function shouldAutoPersistToCloud(input: {
  supabaseConfigured: boolean;
  authMode: string;
  remoteMigrationsApplied: boolean;
}): boolean {
  return input.supabaseConfigured && input.authMode === 'signed-in' && input.remoteMigrationsApplied;
}
