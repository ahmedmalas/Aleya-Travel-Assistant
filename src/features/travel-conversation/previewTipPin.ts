/**
 * Preview tip pin — single source of truth for PR #29 verification.
 * Baked into the bundle at build time. Update when tip redeploys.
 */

/** Sole authoritative immutable preview for personal testing. */
export const AUTHORITATIVE_TEST_URL =
  'https://travel-buddy-assistant-1kemub2h8-ahmedmalas-projects.vercel.app/';

export const AUTHORITATIVE_DEPLOYMENT_ID = 'dpl_GKbx8XW6oPAQzi3eCyZLcBujxrSc';

/** Hostname slug of the authoritative immutable host (no protocol). */
export const AUTHORITATIVE_HOST =
  'travel-buddy-assistant-1kemub2h8-ahmedmalas-projects.vercel.app';

/**
 * Immutable hostname markers that must never be used for tip verification.
 * Matching hosts show a full-page DO-NOT-TEST gate when this tip code is loaded.
 * (Obsolete deploys that predate this gate cannot self-warn — delete them in Vercel.)
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

export function isSupersededPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host.includes('vercel.app')) return false;
  if (host === AUTHORITATIVE_HOST) return false;
  // Branch alias moves — not treated as superseded by marker, but tip pin prefers immutable.
  return SUPERSEDED_HOST_MARKERS.some((marker) => host.includes(marker));
}
