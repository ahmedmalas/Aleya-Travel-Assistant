/**
 * Structured conversational options + contextual reference resolution contracts.
 * Options are recorded when Aleya presents a selectable question — not inferred
 * from raw reply text at answer time.
 */

export type ConversationalOptionCategory =
  | 'service'
  | 'location'
  | 'date'
  | 'trip_type'
  | 'traveller'
  | 'preference'
  | 'search_action';

export type ConversationalOption = {
  id: string;
  label: string;
  value: unknown;
  category: ConversationalOptionCategory;
  position: number;
};

export type ActiveOptionSet = {
  /** Stable id for this presentation (also used as sourceOptionSetId). */
  id: string;
  sourceTurnId: string;
  question: string;
  options: ConversationalOption[];
  selectionMode: 'single' | 'multiple';
  /** Missing-requirement / awaiting identity when applicable. */
  awaitingField?: string;
  createdAt: string;
};

export type ContextualReferenceResolution = {
  resolved: boolean;
  sourceOptionSetId?: string;
  selectedOptionIds: string[];
  excludedOptionIds: string[];
  confidence: number;
  explanation?: string;
};

/** Validated merge payload after combining contextual + explicit selections. */
export type CombinedValidatedSelections = {
  optionSetId?: string;
  category?: ConversationalOptionCategory;
  selectedOptionIds: string[];
  excludedOptionIds: string[];
  /** Resolved values from selected options (typed by category at apply time). */
  selectedValues: unknown[];
  explicitSelectionIds: string[];
  confidence: number;
  ok: boolean;
  reason?: string;
};
