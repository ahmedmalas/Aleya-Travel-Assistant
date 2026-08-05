/**
 * conversation-interpretation — semantic meaning ownership for Aleya.
 *
 * Governed engine: `interpretSemanticMeaning` → architecture SemanticInterpretation.
 * Legacy compatibility (temporary): `interpretTravelUtterance` still maps to
 * ConversationStateUpdate for the dual-run / production-off path.
 */

export { resolveCalendarDateIso } from './calendarDateSemantics';
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
export { interpretSemanticMeaning } from './interpretSemanticMeaning';
export { validateAndMapSemanticInterpretation } from './validateAndMap';
export { canonicalizeSemanticPlaces } from './canonicalizePlaces';
