/**
 * Temporary per-turn runtime evidence for PR #29 preview verification.
 * Captured from the same runtime call that produces the visible reply.
 * Remove after personal verification.
 */

import type { TravelServiceKind } from './types';
import type { ProviderLaunchResult } from './search-projection/types';
import type {
  ActiveOptionSet,
  CombinedValidatedSelections,
  ContextualReferenceResolution,
} from './contextual-reference';

export type TurnRuntimeEvidence = {
  hostname: string;
  buildGitSha: string;
  loadedTravelChunk: string;
  engineEntry: 'runConversationTurn';
  conversationSessionId: string;
  turnNumber: number;
  replySource: 'generateResponse';
  nextRequiredField: string | null;
  generatedReply: string;
  /** Extra runtime fingerprints for mixed-session diagnosis. */
  deploymentIdHeader: string | null;
  scriptUrls: string[];
  hasP8G9cQpqScript: boolean;
  consultantChunkLoaded: boolean;
  capturedAt: string;
  /** Search-launch observation (authorised-search turns). */
  requestedServices: TravelServiceKind[];
  projectedProviderActions: Array<{
    service: TravelServiceKind;
    provider: string;
    url: string;
  }>;
  providerLaunchResults: ProviderLaunchResult[];
  openedServices: TravelServiceKind[];
  readyForUserServices: TravelServiceKind[];
  blockedServices: TravelServiceKind[];
  failedServices: TravelServiceKind[];
  responseObservation: string | null;
  /** Contextual reference observation. */
  activeOptionSet: ActiveOptionSet | null;
  contextualReferenceDetected: boolean;
  contextualReferenceResolution: ContextualReferenceResolution | null;
  selectedOptionIds: string[];
  excludedOptionIds: string[];
  explicitSelections: string[];
  combinedValidatedSelections: CombinedValidatedSelections | null;
  canonicalStateBefore: {
    origin?: string;
    destination?: string;
    services: TravelServiceKind[];
  };
  canonicalStateAfter: {
    origin?: string;
    destination?: string;
    services: TravelServiceKind[];
  };
};

function resolveTravelChunkFromModuleUrl(): string {
  try {
    const url = String(import.meta.url);
    const match = url.match(/travel-conversation-[A-Za-z0-9_-]+\.js/);
    if (match?.[0]) return match[0];
    const file = url.split('/').pop();
    if (file?.includes('travel-conversation')) return file.split('?')[0] ?? file;
    if (url.includes('travel-conversation')) return url.split('/').slice(-3).join('/');
  } catch {
    // ignore
  }
  return 'travel-conversation-(unresolved)';
}

function resolveGitSha(): string {
  return (
    (import.meta.env.VITE_GIT_SHA as string | undefined)?.trim() ||
    (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined)?.slice(0, 7) ||
    'local-dev'
  );
}

function listScriptUrls(): string[] {
  if (typeof document === 'undefined') return [];
  try {
    const fromDom = [...document.scripts].map((s) => s.src).filter(Boolean);
    const fromPerf =
      typeof performance !== 'undefined'
        ? performance
            .getEntriesByType('resource')
            .map((r) => r.name)
            .filter((n) => /\.js(\?|$)/i.test(n))
        : [];
    return [...new Set([...fromDom, ...fromPerf])];
  } catch {
    return [];
  }
}

function readDeploymentIdFromMeta(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const feedback = document.querySelector('script[data-deployment-id]');
    const id = feedback?.getAttribute('data-deployment-id');
    return id || null;
  } catch {
    return null;
  }
}

/** Live build identity — resolved from this module instance, not hand-written. */
export function resolveLiveBuildFingerprint(): {
  gitSha: string;
  chunk: string;
  engineEntry: 'runConversationTurn';
} {
  return {
    gitSha: resolveGitSha(),
    chunk: resolveTravelChunkFromModuleUrl(),
    engineEntry: 'runConversationTurn',
  };
}

/**
 * Build per-turn evidence from the same call that produced `generatedReply`.
 * Must be invoked immediately after `generateResponse` inside `runConversationTurn`.
 */
export function captureTurnRuntimeEvidence(input: {
  conversationSessionId: string;
  turnNumber: number;
  replySource: 'generateResponse';
  nextRequiredField: string | null;
  generatedReply: string;
  requestedServices?: TravelServiceKind[];
  projectedProviderActions?: Array<{
    service: TravelServiceKind;
    provider: string;
    url: string;
  }>;
  providerLaunchResults?: ProviderLaunchResult[];
  openedServices?: TravelServiceKind[];
  readyForUserServices?: TravelServiceKind[];
  blockedServices?: TravelServiceKind[];
  failedServices?: TravelServiceKind[];
  responseObservation?: string | null;
  activeOptionSet?: ActiveOptionSet | null;
  contextualReferenceDetected?: boolean;
  contextualReferenceResolution?: ContextualReferenceResolution | null;
  selectedOptionIds?: string[];
  excludedOptionIds?: string[];
  explicitSelections?: string[];
  combinedValidatedSelections?: CombinedValidatedSelections | null;
  canonicalStateBefore?: {
    origin?: string;
    destination?: string;
    services: TravelServiceKind[];
  };
  canonicalStateAfter?: {
    origin?: string;
    destination?: string;
    services: TravelServiceKind[];
  };
}): TurnRuntimeEvidence {
  const fingerprint = resolveLiveBuildFingerprint();
  const scriptUrls = listScriptUrls();
  const evidence: TurnRuntimeEvidence = {
    hostname: typeof location !== 'undefined' ? location.hostname : '(ssr)',
    buildGitSha: fingerprint.gitSha,
    loadedTravelChunk: fingerprint.chunk,
    engineEntry: fingerprint.engineEntry,
    conversationSessionId: input.conversationSessionId,
    turnNumber: input.turnNumber,
    replySource: input.replySource,
    nextRequiredField: input.nextRequiredField,
    generatedReply: input.generatedReply,
    deploymentIdHeader: readDeploymentIdFromMeta(),
    scriptUrls,
    hasP8G9cQpqScript: scriptUrls.some((u) => /P8G9cQpq/i.test(u)),
    consultantChunkLoaded: scriptUrls.some((u) => /consultant/i.test(u)),
    capturedAt: new Date().toISOString(),
    requestedServices: input.requestedServices ?? [],
    projectedProviderActions: input.projectedProviderActions ?? [],
    providerLaunchResults: input.providerLaunchResults ?? [],
    openedServices: input.openedServices ?? [],
    readyForUserServices: input.readyForUserServices ?? [],
    blockedServices: input.blockedServices ?? [],
    failedServices: input.failedServices ?? [],
    responseObservation: input.responseObservation ?? null,
    activeOptionSet: input.activeOptionSet ?? null,
    contextualReferenceDetected: input.contextualReferenceDetected ?? false,
    contextualReferenceResolution: input.contextualReferenceResolution ?? null,
    selectedOptionIds: input.selectedOptionIds ?? [],
    excludedOptionIds: input.excludedOptionIds ?? [],
    explicitSelections: input.explicitSelections ?? [],
    combinedValidatedSelections: input.combinedValidatedSelections ?? null,
    canonicalStateBefore: input.canonicalStateBefore ?? { services: [] },
    canonicalStateAfter: input.canonicalStateAfter ?? { services: [] },
  };

  if (typeof window !== 'undefined') {
    const w = window as Window & {
      __ALEYA_LAST_TURN_EVIDENCE__?: TurnRuntimeEvidence;
      __ALEYA_TURN_EVIDENCE_LOG__?: TurnRuntimeEvidence[];
      __ALEYA_ENGINE_ENTRY__?: string;
      __ALEYA_CONVERSATION_SESSION_ID__?: string;
    };
    w.__ALEYA_LAST_TURN_EVIDENCE__ = evidence;
    w.__ALEYA_ENGINE_ENTRY__ = evidence.engineEntry;
    w.__ALEYA_CONVERSATION_SESSION_ID__ = evidence.conversationSessionId;
    const log = w.__ALEYA_TURN_EVIDENCE_LOG__ ?? [];
    log.push(evidence);
    w.__ALEYA_TURN_EVIDENCE_LOG__ = log.slice(-40);
    try {
      window.sessionStorage.setItem(
        'aleya-travel:last-turn-evidence',
        JSON.stringify(evidence),
      );
      window.sessionStorage.setItem(
        'aleya-travel:engine-entry',
        evidence.engineEntry,
      );
      window.sessionStorage.setItem(
        'aleya-travel:loaded-chunk',
        evidence.loadedTravelChunk,
      );
      window.sessionStorage.setItem(
        'aleya-travel:build-git-sha',
        evidence.buildGitSha,
      );
    } catch {
      // ignore quota / private mode
    }
  }

  return evidence;
}
