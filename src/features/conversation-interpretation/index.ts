/**
 * conversation-interpretation — authoritative semantic travel utterance boundary.
 *
 * Production panel calls interpretTravelUtterance, then passes the validated
 * ConversationStateUpdate into processConversationTurn with skipExtraction.
 */

export {
  interpretTravelUtterance,
} from './interpretTravelUtterance';
export {
  deriveActiveTravelRequirement,
} from './deriveActiveRequirement';
export {
  travelSemanticInterpretationSchema,
  emptySemanticInterpretation,
  type TravelSemanticInterpretation,
} from './schema';
export type {
  ActiveTravelRequirement,
  InterpretTravelUtteranceInput,
  InterpretTravelUtteranceResult,
  InterpretationSource,
  SemanticInterpreterPort,
} from './types';
export { interpretOfflineSemantic } from './offlineSemanticInterpreter';
export { validateAndMapSemanticInterpretation } from './validateAndMap';
export { canonicalizeSemanticPlaces } from './canonicalizePlaces';
