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
    transcript: [],
  };
}
