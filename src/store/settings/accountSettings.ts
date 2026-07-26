import type { TravelBuddyClient } from '../../lib/supabase/client';
import { getSupabaseClient } from '../../lib/supabase/client';
import { STORAGE_KEYS } from '../storeConstants';

export type NotificationPreferences = {
  departures: boolean;
  documentExpiry: boolean;
  unpaidExpenses: boolean;
  bookingReminders: boolean;
  itineraryConflicts: boolean;
  packingDeadlines: boolean;
};

export type AccountSettings = {
  displayName: string;
  email: string;
  currency: string;
  timezone: string;
  notificationPreferences: NotificationPreferences;
  updatedAt: string;
};

export type AccountSettingsResult<T> = { ok: true; value: T } | { ok: false; message: string };

export const ACCOUNT_SETTINGS_STORAGE_KEY = 'travel-buddy:account-settings:v1';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  departures: true,
  documentExpiry: true,
  unpaidExpenses: true,
  bookingReminders: true,
  itineraryConflicts: true,
  packingDeadlines: true,
};

export const createDefaultAccountSettings = (): AccountSettings => ({
  displayName: 'Demo Traveller',
  email: 'demo@travelbuddy.local',
  currency: 'USD',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  updatedAt: new Date().toISOString(),
});

export const loadAccountSettings = (): AccountSettings => {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultAccountSettings();
    const parsed = JSON.parse(raw) as Partial<AccountSettings>;
    return {
      ...createDefaultAccountSettings(),
      ...parsed,
      notificationPreferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(parsed.notificationPreferences ?? {}),
      },
    };
  } catch {
    return createDefaultAccountSettings();
  }
};

export const persistAccountSettings = (settings: AccountSettings): void => {
  try {
    window.localStorage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors.
  }
};

export const updateAccountSettings = (
  current: AccountSettings,
  patch: Partial<Omit<AccountSettings, 'updatedAt' | 'notificationPreferences'>> & {
    notificationPreferences?: Partial<NotificationPreferences>;
  },
): AccountSettings => ({
  ...current,
  ...patch,
  notificationPreferences: {
    ...current.notificationPreferences,
    ...(patch.notificationPreferences ?? {}),
  },
  updatedAt: new Date().toISOString(),
});

export async function syncAccountSettingsToCloud(
  settings: AccountSettings,
  client: TravelBuddyClient | null = getSupabaseClient(),
): Promise<AccountSettingsResult<AccountSettings>> {
  persistAccountSettings(settings);
  if (!client) {
    return { ok: true, value: settings };
  }
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, message: 'Sign in required to sync account settings.' };
  }
  const { error } = await client.from('profiles').upsert({
    id: userData.user.id,
    email: settings.email,
    display_name: settings.displayName,
    currency: settings.currency,
    timezone: settings.timezone,
    notification_preferences: settings.notificationPreferences,
    updated_at: settings.updatedAt,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, value: settings };
}

export function exportAccountDataBundle(input: {
  settings: AccountSettings;
  vaultJson: string;
  templatesJson?: string;
}): string {
  return JSON.stringify(
    {
      schema: 'travel-buddy-account-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: input.settings,
      vault: JSON.parse(input.vaultJson),
      templates: input.templatesJson ? JSON.parse(input.templatesJson) : [],
      storageKeys: STORAGE_KEYS,
    },
    null,
    2,
  );
}

export type AccountDeletionGuard = {
  canDelete: boolean;
  blockers: string[];
  confirmationPhrase: string;
};

export const evaluateAccountDeletion = (input: {
  confirmation: string;
  activeTripCount: number;
  hasPendingSync: boolean;
}): AccountDeletionGuard => {
  const confirmationPhrase = 'DELETE MY ACCOUNT';
  const blockers: string[] = [];
  if (input.confirmation.trim() !== confirmationPhrase) {
    blockers.push(`Type ${confirmationPhrase} to confirm.`);
  }
  if (input.activeTripCount > 0) {
    blockers.push('Export or delete trips before account deletion.');
  }
  if (input.hasPendingSync) {
    blockers.push('Resolve pending sync changes before deletion.');
  }
  return {
    canDelete: blockers.length === 0,
    blockers,
    confirmationPhrase,
  };
};

/**
 * Clears local account artefacts and attempts a best-effort cloud sign-out.
 * Full auth-user hard-delete requires a privileged server function; this phase
 * anonymises/removes local data and documents the remaining external step.
 */
export async function requestAccountDeletion(input: {
  confirmation: string;
  activeTripCount: number;
  hasPendingSync: boolean;
  client?: TravelBuddyClient | null;
}): Promise<AccountSettingsResult<{ clearedLocal: boolean; cloudMessage: string }>> {
  const guard = evaluateAccountDeletion(input);
  if (!guard.canDelete) {
    return { ok: false, message: guard.blockers.join(' ') };
  }
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.removeItem(ACCOUNT_SETTINGS_STORAGE_KEY);
    window.localStorage.removeItem(SUPPORT_STORAGE_KEY_SAFE);
  } catch {
    // Continue — best effort.
  }
  const client = input.client === undefined ? getSupabaseClient() : input.client;
  if (!client) {
    return {
      ok: true,
      value: {
        clearedLocal: true,
        cloudMessage:
          'Local data cleared. No cloud client configured — remote auth deletion remains an external admin/server step.',
      },
    };
  }
  const { error: signOutError } = await client.auth.signOut();
  return {
    ok: true,
    value: {
      clearedLocal: true,
      cloudMessage: signOutError
        ? `Local data cleared. Cloud sign-out failed: ${signOutError.message}. Hard-delete of the auth user still requires a privileged server function.`
        : 'Local data cleared and session signed out. Hard-delete of the auth user still requires a privileged server function / support action.',
    },
  };
}

/** Avoid circular import with support centre storage key. */
const SUPPORT_STORAGE_KEY_SAFE = 'travel-buddy:support-tickets:v1';
