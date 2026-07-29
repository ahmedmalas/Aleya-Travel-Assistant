/**
 * Canonical first-principles conversation-core state.
 *
 * Phase 2C increments turnCount once per completed user-assistant pair.
 * No travel intelligence, persistence, or schema lineage.
 */

/** Reserved for a later persistence piece — not used in this phase. */
export const CONVERSATION_CORE_STORAGE_NAMESPACE =
  'aleya-travel:conversation-core:first-principles' as const;

export type ConversationCoreStatus = 'empty' | 'active';

/** Chronological transcript memory only — not intelligence. */
export type ConversationTranscriptEntry =
  | {
      id: string;
      role: 'user';
      message: string;
      timestamp: string;
    }
  | {
      id: string;
      role: 'assistant';
      message: string;
      timestamp: string;
    };

export type ConversationCoreState = {
  conversationId: string;
  status: ConversationCoreStatus;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
  /** Derived conversation age in milliseconds from createdAt. */
  ageMs: number;
  /** Explicitly supplied destination only — never extracted from message text. */
  destination: string | null;
  /** Explicitly supplied origin only — never extracted from message text. */
  origin: string | null;
  /** Explicitly supplied departure date only — never extracted from message text. */
  departureDate: string | null;
  /** Explicitly supplied return date only — never extracted from message text. */
  returnDate: string | null;
  /** Explicitly supplied adult count only — never extracted from message text. */
  adultCount: number | null;
  /** Explicitly supplied child count only — never extracted from message text. */
  childCount: number | null;
  /** Explicitly supplied infant count only — never extracted from message text. */
  infantCount: number | null;
  /** Explicitly supplied flights request flag only — never detected from message text. */
  flightsRequested: boolean | null;
  /** Explicitly supplied accommodation request flag only — never detected from message text. */
  accommodationRequested: boolean | null;
  /** Explicitly supplied car-hire request flag only — never detected from message text. */
  carHireRequested: boolean | null;
  /** Explicitly supplied activities request flag only — never detected from message text. */
  activitiesRequested: boolean | null;
  /** Explicitly supplied restaurants request flag only — never detected from message text. */
  restaurantsRequested: boolean | null;
  transcript: ConversationTranscriptEntry[];
};

export type CreateInitialConversationCoreStateInput = {
  conversationId: string;
  now: Date;
};

/**
 * Sole public initial-state factory.
 *
 * Deterministic for identical inputs. Does not read time or ID from globals.
 */
export function createInitialConversationCoreState(
  input: CreateInitialConversationCoreStateInput,
): ConversationCoreState {
  const instant = input.now.toISOString();
  return {
    conversationId: input.conversationId,
    status: 'empty',
    turnCount: 0,
    createdAt: instant,
    updatedAt: instant,
    ageMs: 0,
    destination: null,
    origin: null,
    departureDate: null,
    returnDate: null,
    adultCount: null,
    childCount: null,
    infantCount: null,
    flightsRequested: null,
    accommodationRequested: null,
    carHireRequested: null,
    activitiesRequested: null,
    restaurantsRequested: null,
    transcript: [],
  };
}
