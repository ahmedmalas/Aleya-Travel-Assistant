import type {
  ConversationCoreState,
  ConversationStateUpdate,
  ConversationTranscriptEntry,
} from '../conversation-core';
import type { TravelSemanticInterpretation } from './schema';

export type ActiveTravelRequirement =
  | 'destination'
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
  /**
   * Force offline semantic path (tests). When omitted, AI is tried first
   * then offline semantic, then regex fallback.
   */
  mode?: 'auto' | 'ai' | 'offline-semantic' | 'regex-fallback';
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
};

export type SemanticInterpreterPort = {
  interpret(
    input: InterpretTravelUtteranceInput & {
      activeRequirement: ActiveTravelRequirement;
    },
  ): Promise<TravelSemanticInterpretation | null>;
};
