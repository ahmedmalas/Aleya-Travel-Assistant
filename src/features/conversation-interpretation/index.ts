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
  buildInterpretationContext,
  type TravelInterpretationContext,
} from './buildInterpretationContext';
export { buildInterpretationPrompt } from './buildInterpretationPrompt';
export {
  recognizeTravelServicesInMessage,
  editDistance,
} from './serviceRecognitionSemantics';
export { extractRelativeDurationMeaning } from './relativeDurationSemantics';
export { resolveContextualCompletionSemantics } from './contextualCompletionSemantics';
export { resolveContextualConfirmationSemantics } from './contextualConfirmationSemantics';
export { resolveContextualTemporalSemantics } from './contextualTemporalSemantics';
export { resolveTravellerCountSemantics } from './travellerCountSemantics';
export {
  isShapeValidPlaceName,
  type PlaceResolutionStatus,
} from './placeResolution';
export {
  canSafelyConstructProviderSearch,
  isPlaceStatusSafeForProviderSearch,
} from './providerSearchSafety';
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
