/**
 * Preview tip pin — single source of truth for PR #29 verification.
 * Baked into the bundle at build time. Update when the sole tip changes.
 */

/** Sole authoritative immutable preview for personal testing. */
export const AUTHORITATIVE_TEST_URL =
  'https://travel-buddy-assistant-1kemub2h8-ahmedmalas-projects.vercel.app/';

export const AUTHORITATIVE_DEPLOYMENT_ID = 'dpl_GKbx8XW6oPAQzi3eCyZLcBujxrSc';

/** Hostname of the authoritative immutable host (no protocol). */
export const AUTHORITATIVE_HOST =
  'travel-buddy-assistant-1kemub2h8-ahmedmalas-projects.vercel.app';

/**
 * Technical host-marker blocklist for tip builds that include SupersededPreviewGate.
 * These strings are NOT test URLs and MUST NOT be used as verification links.
 * Tip-side gate cannot alter immutable deploys that predate the gate.
 */
export const SUPERSEDED_HOST_MARKERS = [
  '40wg4wfhx',
  'q3fvjxed4',
  'lmttqef7g',
  '87p717iv6',
  '8wo8li78z',
  'd57we27p8',
  '6c04h1wki',
  'oszm3kqmv',
  '4ejlmzpy0',
  'lv2i2tgob',
  'c2qc3eo70',
] as const;

const PRODUCTION_HOSTS = new Set([
  'travel-buddy-assistant-ai.vercel.app',
  'www.travel-buddy-assistant-ai.vercel.app',
]);

export function isSupersededPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host.includes('vercel.app')) return false;
  if (host === AUTHORITATIVE_HOST) return false;
  if (PRODUCTION_HOSTS.has(host)) return false;
  if (host.includes('-git-main-')) return false;
  // Quarantine every other project preview host (immutable + branch alias).
  if (host.includes('travel-buddy-assistant')) return true;
  return SUPERSEDED_HOST_MARKERS.some((marker) => host.includes(marker));
}
