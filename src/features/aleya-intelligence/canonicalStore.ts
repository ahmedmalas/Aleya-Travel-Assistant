import { useSyncExternalStore } from 'react';
import type { ConversationState } from './types';
import { createEmptyConversationState } from './types';

type Listener = () => void;

/**
 * Single source of truth for live travel conversation state.
 * Extraction, memory merge, clarification, UI summary, and search forms
 * all read/write through this store when using handleTravelChatMessage.
 */
let canonicalState: ConversationState = createEmptyConversationState();
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getCanonicalTravelState(): ConversationState {
  return canonicalState;
}

export function setCanonicalTravelState(next: ConversationState): void {
  canonicalState = next;
  emit();
}

export function resetCanonicalTravelState(conversationId?: string): void {
  canonicalState = createEmptyConversationState(conversationId);
  emit();
}

export function subscribeCanonicalTravelState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React binding — every consumer sees the same merged ConversationState. */
export function useCanonicalTravelState(): ConversationState {
  return useSyncExternalStore(
    subscribeCanonicalTravelState,
    getCanonicalTravelState,
    getCanonicalTravelState,
  );
}
