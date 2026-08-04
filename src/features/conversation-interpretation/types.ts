import type {
  ConversationCoreState,
  ConversationStateUpdate,
  ConversationTranscriptEntry,
} from '../conversation-core';
import type { TravelSemanticInterpretation } from './schema';
import type { TravelInterpretationContext } from './buildInterpretationContext';

export type ActiveTravelRequirement =
  | 'destination'
  | 'destinationStops'
  | 'origin'
  | 'departureDate'
  | 'returnDate'
  | 'adultCount'
  | 'childCount'
  | 'infantCount'
  | 'services'
  | 'none';

export type InterpretTravelUtteranceInput = {
  message: string;
  currentState: ConversationCoreState;
  /** Recent transcript for multi-turn context (read-only). */
  recentHistory?: ConversationTranscriptEntry[];
  /** Override active requirement; otherwise derived from state. */
  activeRequirement?: ActiveTravelRequirement;
  /** Deterministic clock for relative date resolution / prompts. */
  now?: Date;
  /**
   * Force offline semantic path (tests). When omitted, AI is tried first
   * then offline semantic, then regex fallback.
   */
  mode?: 'auto' | 'ai' | 'offline-semantic' | 'regex-fallback';
  /**
   * Injectable AI interpreter for tests. Receives the full interpretation
   * context package that production AI receives.
   */
  aiInterpret?: (
    context: TravelInterpretationContext,
  ) => Promise<TravelSemanticInterpretation | null>;
};

export type InterpretationSource =
  | 'ai'
  | 'offline-semantic'
  | 'regex-fallback'
  | 'empty';

export type InterpretTravelUtteranceResult = {
  source: InterpretationSource;
  semantic: TravelSemanticInterpretation;
  stateUpdate: ConversationStateUpdate;
  /** True when interpretation produced a validated travel-field update. */
  interpreted: boolean;
  warnings: string[];
  /** Context package actually supplied to interpretation (for tests/audit). */
  context?: TravelInterpretationContext;
};

export type SemanticInterpreterPort = {
  interpret(
    input: InterpretTravelUtteranceInput & {
      activeRequirement: ActiveTravelRequirement;
    },
  ): Promise<TravelSemanticInterpretation | null>;
};
