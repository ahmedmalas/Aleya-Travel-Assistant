/**
 * Phase 5 — reversible behaviour switch for the architecture Turn Governor.
 *
 * Resolution order:
 * 1. VITE_ARCHITECTURE_GOVERNOR_SWITCH=true|false → explicit (wins)
 * 2. Vercel Preview (VITE_VERCEL_ENV or VITE_VERCEL_TARGET_ENV === preview) → ON
 * 3. otherwise → OFF (local + production)
 *
 * Production stays OFF unless someone explicitly sets the flag to true
 * (must never be done on the Production environment).
 */

export const ARCHITECTURE_GOVERNOR_SWITCH_ENV =
  'VITE_ARCHITECTURE_GOVERNOR_SWITCH';

export const VERCEL_ENV_MIRROR = 'VITE_VERCEL_ENV';
export const VERCEL_TARGET_ENV_MIRROR = 'VITE_VERCEL_TARGET_ENV';

function readEnvBag(): Record<string, string | boolean | undefined> {
  try {
    const env = import.meta.env as
      | Record<string, string | boolean | undefined>
      | undefined;
    return env ?? {};
  } catch {
    return {};
  }
}

/**
 * True on Vercel Preview builds (never production).
 */
export function isVercelPreviewBuild(
  env: Record<string, string | boolean | undefined> = readEnvBag(),
): boolean {
  const vercelEnv = env[VERCEL_ENV_MIRROR];
  if (typeof vercelEnv === 'string' && vercelEnv.trim().toLowerCase() === 'preview') {
    return true;
  }
  const target = env[VERCEL_TARGET_ENV_MIRROR];
  if (typeof target === 'string' && target.trim().toLowerCase() === 'preview') {
    return true;
  }
  return false;
}

/**
 * Read the architecture governor behaviour switch.
 * Defaults ON for every Vercel Preview; OFF for production/local.
 */
export function isArchitectureBehaviourSwitchActive(
  env: Record<string, string | boolean | undefined> | undefined = readEnvBag(),
): boolean {
  const source = env ?? {};
  const raw = source[ARCHITECTURE_GOVERNOR_SWITCH_ENV];
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return isVercelPreviewBuild(source);
}
