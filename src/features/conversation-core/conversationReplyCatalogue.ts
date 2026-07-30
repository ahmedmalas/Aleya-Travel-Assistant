/**
 * Internal deterministic travel-consultant reply catalogue.
 *
 * Phase 10K — owns fixed acknowledgement and follow-up wording only.
 * Contains deterministic fixed strings (and pure wording templates for
 * interpolated values). Has no selection logic, eligibility rules,
 * priority, suppression, state mutation, AI, or randomness.
 */
export const CONVERSATION_REPLY_CATALOGUE = {
  acknowledgements: {
    addedCapabilities: (labelList: string) =>
      `I've added ${labelList} to your trip requirements.`,
    destination: (destination: string) => `Sounds good — ${destination}.`,
    origin: (origin: string) => `Got it — travelling from ${origin}.`,
    genericTravelFieldChange: 'Got it.',
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
