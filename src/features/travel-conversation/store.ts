import { useSyncExternalStore } from 'react';
import type { ConversationState } from './types';
import {
  CONVERSATION_SCHEMA_VERSION,
  createEmptyConversationState,
} from './types';

type Listener = () => void;

/** New schema — incompatible prior payloads are discarded. */
export const STORAGE_KEY = 'aleya-travel:conversation:v3';

/** Keys from deleted implementations — always purged on boot. */
export const LEGACY_STORAGE_KEYS = [
  'aleya-travel:conversation:v1',
  'aleya-travel:conversation:v2',
  'aleya-intelligence:conversation',
  'aleya-intelligence:state',
  'aleya:conversationState',
];

type PersistedEnvelope = {
  schemaVersion: number;
  state: ConversationState;
};

let memoryState: ConversationState = createEmptyConversationState();
const listeners = new Set<Listener>();
let hydrated = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function purgeLegacyKeys(): void {
  if (!canUseStorage()) return;
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

function readPersisted(): ConversationState | undefined {
  if (!canUseStorage()) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as PersistedEnvelope;
    if (parsed.schemaVersion !== CONVERSATION_SCHEMA_VERSION) {
      window.localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    if (parsed.state?.schemaVersion !== CONVERSATION_SCHEMA_VERSION) {
      window.localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return parsed.state;
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return undefined;
  }
}

function writePersisted(state: ConversationState): void {
  if (!canUseStorage()) return;
  try {
    const envelope: PersistedEnvelope = {
      schemaVersion: CONVERSATION_SCHEMA_VERSION,
      state,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore quota / private mode
  }
}

/** Hydrate once from v3 storage; discard incompatible / legacy data. */
export function hydrateTravelConversation(): ConversationState {
  if (hydrated) return memoryState;
  purgeLegacyKeys();
  const loaded = readPersisted();
  memoryState = loaded ?? createEmptyConversationState();
  hydrated = true;
  return memoryState;
}

/** Test / refresh simulation — re-read storage into memory. */
export function rehydrateTravelConversation(): ConversationState {
  hydrated = false;
  return hydrateTravelConversation();
}

export function getTravelConversation(): ConversationState {
  if (!hydrated) hydrateTravelConversation();
  return memoryState;
}

export function setTravelConversation(next: ConversationState): void {
  memoryState = next;
  writePersisted(next);
  emit();
}

export function resetTravelConversation(): ConversationState {
  purgeLegacyKeys();
  memoryState = createEmptyConversationState();
  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  hydrated = true;
  emit();
  return memoryState;
}

export function subscribeTravelConversation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTravelConversation(): ConversationState {
  return useSyncExternalStore(
    subscribeTravelConversation,
    getTravelConversation,
    createEmptyConversationState,
  );
}
