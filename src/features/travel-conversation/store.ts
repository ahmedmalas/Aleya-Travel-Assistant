import { useSyncExternalStore } from 'react';
import { resetConversationRuntime } from './conversation/runtime';
import type { ConversationState, StoredTravelLocation } from './types';
import {
  CONVERSATION_SCHEMA_VERSION,
  createEmptyConversationState,
} from './types';
import { getDefaultLocationProvider, toStoredTravelLocation } from '../travel-location-intelligence';

type Listener = () => void;

/** Schema v7 — authoritative key (discovery + structured locations). */
export const STORAGE_KEY = 'aleya-travel:conversation:v7';

/** All prior engines / schemas — purged on hydrate and reset (v5/v6 migrated when possible). */
export const LEGACY_STORAGE_KEYS = [
  'aleya-travel:conversation:v1',
  'aleya-travel:conversation:v2',
  'aleya-travel:conversation:v3',
  'aleya-travel:conversation:v4',
  'aleya-intelligence:conversation',
  'aleya-intelligence:state',
  'aleya:conversationState',
];

const V5_STORAGE_KEY = 'aleya-travel:conversation:v5';
const V6_STORAGE_KEY = 'aleya-travel:conversation:v6';

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

function placeFromString(name?: string): StoredTravelLocation | undefined {
  if (!name) return undefined;
  const hit = getDefaultLocationProvider().resolveSync(name, { allowFuzzy: false })[0]?.place;
  if (!hit) {
    return {
      displayName: name,
      canonicalName: name,
      type: 'unknown',
    };
  }
  return toStoredTravelLocation(hit);
}

/** Migrate schema-v5 string-only locations into structured fields. */
export function migrateConversationStateFromV5(raw: ConversationState): ConversationState {
  const state = sanitizeState({
    ...raw,
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
  });
  if (!state.originPlace && state.origin?.value) {
    state.originPlace = placeFromString(state.origin.value);
  }
  if (!state.destinationPlace && state.destination?.value) {
    state.destinationPlace = placeFromString(state.destination.value);
  }
  if (!state.accommodationPlace && state.accommodationArea?.value) {
    state.accommodationPlace = placeFromString(state.accommodationArea.value);
  }
  return state;
}

export function migrateConversationStateFromV6(raw: ConversationState): ConversationState {
  return sanitizeState({
    ...raw,
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    discovery: raw.discovery,
  });
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
  if (state.discovery) {
    const d = state.discovery;
    if (!Array.isArray(d.criteria?.climate)) d.criteria = { ...(d.criteria ?? {}), climate: [], characters: d.criteria?.characters ?? [], activities: d.criteria?.activities ?? [], exclusions: d.criteria?.exclusions ?? [] };
    if (!Array.isArray(d.criteria.characters)) d.criteria.characters = [];
    if (!Array.isArray(d.criteria.activities)) d.criteria.activities = [];
    if (!Array.isArray(d.criteria.exclusions)) d.criteria.exclusions = [];
    if (!Array.isArray(d.recommendations)) d.recommendations = [];
    if (!Array.isArray(d.rejectedIds)) d.rejectedIds = [];
    if (!Array.isArray(d.lastRecommendedIds)) d.lastRecommendedIds = [];
  }
  state.schemaVersion = CONVERSATION_SCHEMA_VERSION;
  return state;
}

function readPersisted(): ConversationState | undefined {
  if (!canUseStorage()) return undefined;
  try {
    const rawV7 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV7) {
      const parsed = JSON.parse(rawV7) as PersistedEnvelope;
      if (
        parsed.schemaVersion === CONVERSATION_SCHEMA_VERSION &&
        parsed.state?.schemaVersion === CONVERSATION_SCHEMA_VERSION
      ) {
        return sanitizeState(parsed.state);
      }
    }

    const rawV6 = window.localStorage.getItem(V6_STORAGE_KEY);
    if (rawV6) {
      const parsed = JSON.parse(rawV6) as PersistedEnvelope;
      if (parsed.schemaVersion === 6 && parsed.state) {
        const migrated = migrateConversationStateFromV6(parsed.state as ConversationState);
        writePersisted(migrated);
        try {
          window.localStorage.removeItem(V6_STORAGE_KEY);
        } catch {
          // ignore
        }
        return migrated;
      }
    }

    const rawV5 = window.localStorage.getItem(V5_STORAGE_KEY);
    if (rawV5) {
      const parsed = JSON.parse(rawV5) as PersistedEnvelope;
      if (parsed.schemaVersion === 5 && parsed.state) {
        const migrated = migrateConversationStateFromV5(parsed.state as ConversationState);
        writePersisted(migrated);
        try {
          window.localStorage.removeItem(V5_STORAGE_KEY);
        } catch {
          // ignore
        }
        return migrated;
      }
    }

    window.localStorage.removeItem(STORAGE_KEY);
    return undefined;
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
  hydrateTravelConversation();
  purgeLegacyKeys();
  return memoryState;
}

export function setTravelConversation(state: ConversationState): void {
  purgeLegacyKeys();
  memoryState = sanitizeState(state);
  writePersisted(memoryState);
  emit();
}

export function resetTravelConversation(): ConversationState {
  resetConversationRuntime();
  memoryState = createEmptyConversationState();
  writePersisted(memoryState);
  emit();
  return memoryState;
}

export function subscribeTravelConversation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTravelConversation(): ConversationState {
  return useSyncExternalStore(
    subscribeTravelConversation,
    getTravelConversation,
    createEmptyConversationState,
  );
}
