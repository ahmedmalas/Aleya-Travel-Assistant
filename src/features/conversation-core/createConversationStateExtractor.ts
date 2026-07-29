import { AccommodationRequestedConversationStateExtractor } from './AccommodationRequestedConversationStateExtractor';
import { AdultCountConversationStateExtractor } from './AdultCountConversationStateExtractor';
import { CarHireRequestedConversationStateExtractor } from './CarHireRequestedConversationStateExtractor';
import { ChildCountConversationStateExtractor } from './ChildCountConversationStateExtractor';
import { CompositeConversationStateExtractor } from './CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from './DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from './DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from './emptyConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from './FlightsRequestedConversationStateExtractor';
import { InfantCountConversationStateExtractor } from './InfantCountConversationStateExtractor';
import { OriginConversationStateExtractor } from './OriginConversationStateExtractor';
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
    new EmptyConversationStateExtractor(),
  ]);
}
