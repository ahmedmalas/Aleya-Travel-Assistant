export type {
  ActiveOptionSet,
  ConversationalOption,
  ConversationalOptionCategory,
  ContextualReferenceResolution,
  CombinedValidatedSelections,
} from './types';

export {
  buildServicesOptionSet,
  buildTripTypeOptionSet,
  buildOptionSet,
  resetOptionSetSequence,
} from './builders';

export {
  getActiveOptionSet,
  setActiveOptionSet,
  clearActiveOptionSet,
  replaceActiveOptionSet,
  resetContextualReferenceRuntime,
  consumeActiveOptionSetAfterResolution,
  expireOptionSetIfInapplicable,
} from './lifecycle';

export {
  resolveContextualReference,
  looksLikeContextualSelection,
} from './resolve';

export { validateContextualResolution } from './validate';
