/**
 * Phase 5 — reversible behaviour switch for the architecture Turn Governor.
 *
 * Default OFF. Enable only on Draft/preview builds via:
 *   VITE_ARCHITECTURE_GOVERNOR_SWITCH=true
 *
 * Never enable by production hostname heuristics. Production stays legacy
 * unless this explicit flag is set (which must not be set in Production env).
 */

export const ARCHITECTURE_GOVERNOR_SWITCH_ENV =
  'VITE_ARCHITECTURE_GOVERNOR_SWITCH';

/**
 * Read the architecture governor behaviour switch.
 * Returns false unless the env value is exactly the string "true".
 */
export function isArchitectureBehaviourSwitchActive(
  env: Record<string, string | boolean | undefined> = import.meta.env as Record<
    string,
    string | boolean | undefined
  >,
): boolean {
  const raw = env[ARCHITECTURE_GOVERNOR_SWITCH_ENV];
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return false;
  return raw.trim().toLowerCase() === 'true';
}
