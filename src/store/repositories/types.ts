import type { Booking, Expense, Traveller, TripDocument, TripData } from '../tripDomain';
import type { CollaborationMember, CollaborationState, TripTemplate, VaultTrip, TripVaultState } from '../vaultDomain';

/**
 * Cloud-ready repository contracts (Slice 46).
 * Local storage is the active provider; Supabase adapters can implement the same interfaces later.
 */
export type RepositoryResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface TripRepository {
  list(): Promise<VaultTrip[]>;
  getById(id: string): Promise<VaultTrip | null>;
  save(trip: VaultTrip): Promise<RepositoryResult<VaultTrip>>;
  delete(id: string): Promise<RepositoryResult<true>>;
  getVault(): Promise<TripVaultState>;
  saveVault(vault: TripVaultState): Promise<RepositoryResult<TripVaultState>>;
}

export interface BookingRepository {
  listByTrip(tripId: string): Promise<Booking[]>;
  upsert(tripId: string, booking: Booking): Promise<RepositoryResult<Booking>>;
  delete(tripId: string, bookingId: string): Promise<RepositoryResult<true>>;
}

export interface ExpenseRepository {
  listByTrip(tripId: string): Promise<Expense[]>;
  upsert(tripId: string, expense: Expense): Promise<RepositoryResult<Expense>>;
  delete(tripId: string, expenseId: string): Promise<RepositoryResult<true>>;
}

export interface TravellerRepository {
  listByTrip(tripId: string): Promise<Traveller[]>;
  upsert(tripId: string, traveller: Traveller): Promise<RepositoryResult<Traveller>>;
  delete(tripId: string, travellerId: string): Promise<RepositoryResult<true>>;
}

export interface DocumentRepository {
  listByTrip(tripId: string): Promise<TripDocument[]>;
  upsert(tripId: string, document: TripDocument): Promise<RepositoryResult<TripDocument>>;
  delete(tripId: string, documentId: string): Promise<RepositoryResult<true>>;
}

export interface TemplateRepository {
  list(): Promise<TripTemplate[]>;
  save(template: TripTemplate): Promise<RepositoryResult<TripTemplate>>;
  delete(templateId: string): Promise<RepositoryResult<true>>;
}

export interface CollaborationRepository {
  get(tripId: string): Promise<CollaborationState | null>;
  save(tripId: string, collaboration: CollaborationState): Promise<RepositoryResult<CollaborationState>>;
  upsertMember(tripId: string, member: CollaborationMember): Promise<RepositoryResult<CollaborationMember>>;
}

export type DataRepositories = {
  trips: TripRepository;
  bookings: BookingRepository;
  expenses: ExpenseRepository;
  travellers: TravellerRepository;
  documents: DocumentRepository;
  templates: TemplateRepository;
  collaboration: CollaborationRepository;
};

/** Supabase adapter plan — activates when env is configured and target is verified. */
export type CloudAdapterPlan = {
  provider: 'supabase';
  status: 'local-active' | 'env-ready' | 'target-unverified' | 'connected';
  notes: string;
  interfaces: Array<keyof DataRepositories>;
  remoteMigrationsApplied: boolean;
};

export const SUPABASE_ADAPTER_PLAN: CloudAdapterPlan = {
  provider: 'supabase',
  status: 'connected',
  notes:
    'Production target jtktojbvbmiewpntpvhe (aleya travel assistant). Repositories switch to Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY are present. Schema applied on Aleya (PR #19). Do not use retired ref farnjmgwcayvkzuaoifk.',
  interfaces: ['trips', 'bookings', 'expenses', 'travellers', 'documents', 'templates', 'collaboration'],
  remoteMigrationsApplied: true,
};

export type ActiveTripSnapshot = TripData;
