import { AccommodationRequestedConversationStateExtractor } from './AccommodationRequestedConversationStateExtractor';
import { ActivitiesRequestedConversationStateExtractor } from './ActivitiesRequestedConversationStateExtractor';
import { AdultCountConversationStateExtractor } from './AdultCountConversationStateExtractor';
import { BeachesRequestedConversationStateExtractor } from './BeachesRequestedConversationStateExtractor';
import { CarHireRequestedConversationStateExtractor } from './CarHireRequestedConversationStateExtractor';
import { ChildCountConversationStateExtractor } from './ChildCountConversationStateExtractor';
import { CompositeConversationStateExtractor } from './CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from './DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from './DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from './emptyConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from './FlightsRequestedConversationStateExtractor';
import { InfantCountConversationStateExtractor } from './InfantCountConversationStateExtractor';
import { NearbyDiscoveryRequestedConversationStateExtractor } from './NearbyDiscoveryRequestedConversationStateExtractor';
import { OriginConversationStateExtractor } from './OriginConversationStateExtractor';
import { RestaurantsRequestedConversationStateExtractor } from './RestaurantsRequestedConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from './ReturnDateConversationStateExtractor';
import type { ConversationStateExtractor } from './types';

/**
 * Internal construction boundary for conversation-state extractors.
 *
 * Always returns a new CompositeConversationStateExtractor containing a new
 * DestinationConversationStateExtractor, then a new
 * OriginConversationStateExtractor, then a new
 * DepartureDateConversationStateExtractor, then a new
 * ReturnDateConversationStateExtractor, then a new
 * AdultCountConversationStateExtractor, then a new
 * ChildCountConversationStateExtractor, then a new
 * InfantCountConversationStateExtractor, then a new
 * FlightsRequestedConversationStateExtractor, then a new
 * AccommodationRequestedConversationStateExtractor, then a new
 * CarHireRequestedConversationStateExtractor, then a new
 * ActivitiesRequestedConversationStateExtractor, then a new
 * RestaurantsRequestedConversationStateExtractor, then a new
 * NearbyDiscoveryRequestedConversationStateExtractor, then a new
 * BeachesRequestedConversationStateExtractor, then a new
 * EmptyConversationStateExtractor. No configuration, selection, caching, or
 * runtime wiring.
 */
export function createConversationStateExtractor(): ConversationStateExtractor {
  return new CompositeConversationStateExtractor([
    new DestinationConversationStateExtractor(),
    new OriginConversationStateExtractor(),
    new DepartureDateConversationStateExtractor(),
    new ReturnDateConversationStateExtractor(),
    new AdultCountConversationStateExtractor(),
    new ChildCountConversationStateExtractor(),
    new InfantCountConversationStateExtractor(),
    new FlightsRequestedConversationStateExtractor(),
    new AccommodationRequestedConversationStateExtractor(),
    new CarHireRequestedConversationStateExtractor(),
    new ActivitiesRequestedConversationStateExtractor(),
    new RestaurantsRequestedConversationStateExtractor(),
    new NearbyDiscoveryRequestedConversationStateExtractor(),
    new BeachesRequestedConversationStateExtractor(),
    new EmptyConversationStateExtractor(),
  ]);
}
