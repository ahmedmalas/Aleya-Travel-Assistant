/**
 * Phase 5 — reversible behaviour switch for the architecture Turn Governor.
 *
 * Resolution order:
 * 1. VITE_ARCHITECTURE_GOVERNOR_SWITCH=true|false → explicit (wins)
 * 2. VITE_VERCEL_ENV=preview → ON (Draft / PR preview builds only)
 * 3. otherwise → OFF (local + production)
 *
 * Production stays OFF unless someone explicitly sets the flag to true
 * (must never be done on the Production environment).
 */

export const ARCHITECTURE_GOVERNOR_SWITCH_ENV =
  'VITE_ARCHITECTURE_GOVERNOR_SWITCH';

export const VERCEL_ENV_MIRROR = 'VITE_VERCEL_ENV';

/**
 * Read the architecture governor behaviour switch.
 */
export function isArchitectureBehaviourSwitchActive(
  env: Record<string, string | boolean | undefined> = import.meta.env as Record<
    string,
    string | boolean | undefined
  >,
): boolean {
  const raw = env[ARCHITECTURE_GOVERNOR_SWITCH_ENV];
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  const vercelEnv = env[VERCEL_ENV_MIRROR];
  if (typeof vercelEnv === 'string' && vercelEnv.trim().toLowerCase() === 'preview') {
    return true;
  }

  return false;
}
