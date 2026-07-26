import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_TARGET_VERIFICATION, validateSupabaseEnv, type SupabaseEnvConfig } from './env';

/**
 * Loosely typed client — schema SQL is the source of truth in `supabase/migrations/`.
 * Strict generated Database types can replace this after a verified project is linked.
 */
export type TravelBuddyClient = SupabaseClient;

let cachedClient: TravelBuddyClient | null = null;
let cachedConfigKey: string | null = null;

export const getSupabaseConfig = (): SupabaseEnvConfig | null => {
  const validation = validateSupabaseEnv();
  return validation.ok ? validation.config : null;
};

export const isSupabaseConfigured = (): boolean => getSupabaseConfig() !== null;

export const getSupabaseClient = (): TravelBuddyClient | null => {
  const config = getSupabaseConfig();
  if (!config) {
    cachedClient = null;
    cachedConfigKey = null;
    return null;
  }

  const key = `${config.url}|${config.anonKey}`;
  if (cachedClient && cachedConfigKey === key) return cachedClient;

  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'travel-buddy:supabase-auth',
    },
  });
  cachedConfigKey = key;
  return cachedClient;
};

export const getCloudRuntimeStatus = () => {
  const validation = validateSupabaseEnv();
  return {
    targetVerified: SUPABASE_TARGET_VERIFICATION.verified,
    targetReason: SUPABASE_TARGET_VERIFICATION.reason,
    env: validation,
    clientConfigured: validation.ok,
    activeProvider: validation.ok && SUPABASE_TARGET_VERIFICATION.verified ? 'supabase' : 'local-storage',
    remoteMigrationsApplied: SUPABASE_TARGET_VERIFICATION.remoteMigrationsApplied,
    migrationsApplied: SUPABASE_TARGET_VERIFICATION.migrationsApplied,
  };
};

/** Test helper — clears singleton client. */
export const __resetSupabaseClientForTests = (): void => {
  cachedClient = null;
  cachedConfigKey = null;
};
