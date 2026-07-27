import { useSyncExternalStore } from 'react';
import type { ConversationState } from './types';
import {
  CONVERSATION_SCHEMA_VERSION,
  createEmptyConversationState,
} from './types';

type Listener = () => void;

/** Schema v5 — only this key is authoritative. */
export const STORAGE_KEY = 'aleya-travel:conversation:v5';

/** All prior engines / schemas — purged on hydrate and reset. */
export const LEGACY_STORAGE_KEYS = [
  'aleya-travel:conversation:v1',
  'aleya-travel:conversation:v2',
  'aleya-travel:conversation:v3',
  'aleya-travel:conversation:v4',
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
    const state = parsed.state;
    // Migrate deleted planning/confirmation/review phases → readiness model.
    const legacy = state.phase as string | undefined;
    if (!legacy) {
      state.phase = 'requirements';
    } else if (legacy === 'planning' || legacy === 'review' || legacy === 'confirmation') {
      state.phase = 'ready';
    } else if (legacy === 'confirmed') {
      state.phase = 'locked';
    }
    return state;
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
    // ignore
  }
}

export function hydrateTravelConversation(): ConversationState {
  if (hydrated) return memoryState;
  purgeLegacyKeys();
  const loaded = readPersisted();
  memoryState = loaded ?? createEmptyConversationState();
  hydrated = true;
  return memoryState;
}

export function rehydrateTravelConversation(): ConversationState {
  hydrated = false;
  return hydrateTravelConversation();
}

export function getTravelConversation(): ConversationState {
  if (!hydrated) hydrateTravelConversation();
  return memoryState;
}

export function setTravelConversation(next: ConversationState): void {
  purgeLegacyKeys();
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

/** Stable SSR/prerender snapshot — must not allocate a new object per call. */
const SERVER_SNAPSHOT = createEmptyConversationState('ssr-empty');

/** Hydrate once on first client import so UI and engine share the same store immediately. */
if (typeof window !== 'undefined') {
  hydrateTravelConversation();
}

export function useTravelConversation(): ConversationState {
  return useSyncExternalStore(
    subscribeTravelConversation,
    getTravelConversation,
    () => SERVER_SNAPSHOT,
  );
}
