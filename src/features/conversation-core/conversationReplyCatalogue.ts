/**
 * Internal deterministic travel-consultant reply catalogue.
 *
 * Phase 10K — owns fixed acknowledgement and follow-up wording only.
 * Contains deterministic fixed strings (and pure wording templates for
 * interpolated values). Has no selection logic, eligibility rules,
 * priority, suppression, state mutation, AI, or randomness.
 * Phase 10O — destination acknowledgement wording refined to
 * "Great — {destination}."
 * Phase 10P — origin acknowledgement wording refined to
 * "Perfect — departing from {origin}."
 * Phase 10Q — generic acknowledgement wording refined to "Perfect."
 * Phase 10R — departure-date acknowledgement:
 * "Perfect — departing on {departureDate}."
 * Phase 10S — return-date acknowledgement:
 * "Perfect — returning on {returnDate}."
 * Phase 10T — adult-count acknowledgement:
 * "Perfect — {adultCount} adults travelling."
 * Phase 10W — adult-count singular grammar when adultCount === 1:
 * "Perfect — 1 adult travelling."
 * Phase 10U — child-count acknowledgement:
 * "Perfect — {childCount} children travelling."
 * Phase 10X — child-count singular grammar when childCount === 1:
 * "Perfect — 1 child travelling."
 * Phase 10V — infant-count acknowledgement:
 * "Perfect — {infantCount} infants travelling."
 * Phase 10Y — infant-count singular grammar when infantCount === 1:
 * "Perfect — 1 infant travelling."
 */
export const CONVERSATION_REPLY_CATALOGUE = {
  acknowledgements: {
    addedCapabilities: (labelList: string) =>
      `I've added ${labelList} to your trip requirements.`,
    destination: (destination: string) => `Great — ${destination}.`,
    origin: (origin: string) => `Perfect — departing from ${origin}.`,
    departureDate: (departureDate: string) =>
      `Perfect — departing on ${departureDate}.`,
    returnDate: (returnDate: string) =>
      `Perfect — returning on ${returnDate}.`,
    adultCount: (adultCount: number) =>
      adultCount === 1
        ? `Perfect — ${adultCount} adult travelling.`
        : `Perfect — ${adultCount} adults travelling.`,
    childCount: (childCount: number) =>
      childCount === 1
        ? `Perfect — ${childCount} child travelling.`
        : `Perfect — ${childCount} children travelling.`,
    infantCount: (infantCount: number) =>
      infantCount === 1
        ? `Perfect — ${infantCount} infant travelling.`
        : `Perfect — ${infantCount} infants travelling.`,
    genericTravelFieldChange: 'Perfect.',
  },
  followUps: {
    destination: 'Where would you like to travel?',
    origin: 'Where will you be travelling from?',
    departureDate: 'When would you like to depart?',
    returnDate: 'When would you like to return?',
    flightsAdultCount: 'How many adults will be travelling?',
    accommodationGuestCount: 'How many guests will be staying?',
    activities: 'What kinds of activities are you interested in?',
    restaurants: 'What type of dining are you looking for?',
    neutralContinuation: 'What else should I know about your trip?',
  },
} as const;

/** Neutral continuation wording from the reply catalogue. */
export const NEUTRAL_TRIP_FALLBACK_REPLY =
  CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation;
