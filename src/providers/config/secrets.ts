/**
 * Travel supplier secrets.
 *
 * Private API keys / OAuth client secrets must NEVER be embedded in the Vite
 * client bundle. They belong in server-side / edge env only when live
 * integrations are approved.
 *
 * This module only reads optional public identifiers and documents the private
 * key names for future server wiring.
 */

export type TravelSecretBundle = {
  /** Public-safe client ids (never secrets). Empty until configured. */
  public: {
    amadeusClientId: string | null;
    duffelPublicKeyHint: string | null;
    bookingAffiliateId: string | null;
    expediaApiKeyHint: string | null;
    hotelbedsApiKeyHint: string | null;
    viatorPartnerId: string | null;
  };
  /**
   * Names of private env vars expected on the server when live mode is approved.
   * Values are intentionally never read from `import.meta.env`.
   */
  privateEnvKeys: readonly string[];
};

function readPublic(name: string): string | null {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function loadTravelSecrets(): TravelSecretBundle {
  return {
    public: {
      amadeusClientId: readPublic('VITE_TRAVEL_AMADEUS_CLIENT_ID'),
      duffelPublicKeyHint: readPublic('VITE_TRAVEL_DUFFEL_PUBLIC_KEY_HINT'),
      bookingAffiliateId: readPublic('VITE_TRAVEL_BOOKING_AFFILIATE_ID'),
      expediaApiKeyHint: readPublic('VITE_TRAVEL_EXPEDIA_API_KEY_HINT'),
      hotelbedsApiKeyHint: readPublic('VITE_TRAVEL_HOTELBEDS_API_KEY_HINT'),
      viatorPartnerId: readPublic('VITE_TRAVEL_VIATOR_PARTNER_ID'),
    },
    privateEnvKeys: [
      'AMADEUS_CLIENT_ID',
      'AMADEUS_CLIENT_SECRET',
      'DUFFEL_ACCESS_TOKEN',
      'BOOKING_COM_API_KEY',
      'EXPEDIA_RAPID_API_KEY',
      'EXPEDIA_RAPID_SHARED_SECRET',
      'HOTELBEDS_API_KEY',
      'HOTELBEDS_SECRET',
      'VIATOR_API_KEY',
    ] as const,
  };
}

/** True only when a server-side live proxy is explicitly flagged ready. */
export function isLiveTravelProxyEnabled(): boolean {
  const flag = (import.meta.env as Record<string, string | undefined>).VITE_TRAVEL_LIVE_PROXY_ENABLED;
  return flag === 'true' || flag === '1';
}
