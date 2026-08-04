/**
 * conversation-interpretation — authoritative semantic travel utterance boundary.
 *
 * The Consultant Turn Governor calls interpretTravelUtterance, then applies
 * clarify-before-write and commits a validated ConversationStateUpdate through
 * processConversationTurn with skipExtraction.
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
export { resolveAmendmentSemantics } from './amendmentSemantics';
export { resolveContextualCompletionSemantics } from './contextualCompletionSemantics';
export { resolveContextualConfirmationSemantics } from './contextualConfirmationSemantics';
export { resolveContextualTemporalSemantics } from './contextualTemporalSemantics';
export { resolveTravellerCountSemantics } from './travellerCountSemantics';
export {
  resolveTripStructureSemantics,
  buildTripLegsFromStops,
  hasOrderedDestinationListStructure,
} from './tripStructureSemantics';
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
