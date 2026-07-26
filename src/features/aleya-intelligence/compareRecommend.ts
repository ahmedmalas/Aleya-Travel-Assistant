import type { OfferSummary, RecommendationBundle, SearchBundle, ConversationState } from './types';

/**
 * Compare search results and recommend a coherent package.
 */
export function compareAndRecommend(state: ConversationState, search: SearchBundle): RecommendationBundle {
  const primary: OfferSummary[] = [];
  const rationale: string[] = [];

  if (search.flights[0]) {
    primary.push(search.flights[0]);
    rationale.push(
      `Flight option timed for ${state.departureTimePreference?.value === 'after_5pm' ? 'departure after 5pm' : 'your preferred departure window'}.`,
    );
  }
  if (search.hotels[0]) {
    primary.push(search.hotels[0]);
    rationale.push(
      state.accommodationLocation
        ? `Stay focused on ${state.accommodationLocation.value}.`
        : `Stay in ${state.destination?.value ?? 'your destination'}.`,
    );
  }
  if (search.carHire[0]) {
    primary.push(search.carHire[0]);
    rationale.push(
      state.carHireRequirements.includes('align_to_flight_schedule')
        ? 'Car hire aligned to the flight schedule.'
        : 'Car hire available for your dates.',
    );
  }
  if (search.transfers[0] && !search.carHire[0]) {
    primary.push(search.transfers[0]);
    rationale.push('Airport transfer as ground transport.');
  }
  if (search.activities[0]) {
    primary.push(search.activities[0]);
    rationale.push('Activity option matching your destination.');
  }
  if (search.cruises[0]) {
    primary.push(search.cruises[0]);
    rationale.push('Cruise sailing in your travel window.');
  }
  if (search.rail[0] && !search.flights[0]) {
    primary.push(search.rail[0]);
    rationale.push('Rail option for this corridor.');
  }

  if (!primary.length) {
    rationale.push('No ranked offers yet — refine dates or services to continue.');
  }

  return { primary, rationale };
}
