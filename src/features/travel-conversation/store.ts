import { useSyncExternalStore } from 'react';
import { resetConversationRuntime } from './conversation/runtime';
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

/** Strip deleted orchestration fields from older persisted blobs. */
function sanitizeState(raw: ConversationState): ConversationState {
  const state = { ...raw };
  const legacy = state as ConversationState & {
    phase?: unknown;
    pendingClarification?: unknown;
    lastOffer?: unknown;
  };
  delete legacy.phase;
  delete legacy.pendingClarification;
  delete legacy.lastOffer;
  if (!Array.isArray(state.services)) state.services = [];
  if (!Array.isArray(state.excludedServices)) state.excludedServices = [];
  if (!Array.isArray(state.preferences)) state.preferences = [];
  if (!Array.isArray(state.changeHistory)) state.changeHistory = [];
  if (!Array.isArray(state.lastChangedFields)) state.lastChangedFields = [];
  return state;
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
    return sanitizeState(parsed.state);
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
      state: sanitizeState(state),
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
  memoryState = sanitizeState(next);
  writePersisted(memoryState);
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
  resetConversationRuntime();
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

const SERVER_SNAPSHOT = createEmptyConversationState('ssr-empty');

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
