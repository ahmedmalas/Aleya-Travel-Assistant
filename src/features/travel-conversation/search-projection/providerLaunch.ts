/**
 * Browser-safe provider search launch.
 *
 * Contract: never claim "opened" without a valid window reference.
 * Never fire deferred multi-popup loops. At most one automatic open from
 * the current user gesture; remaining searches stay ready_for_user.
 */

import type { ConversationState, TravelServiceKind } from '../types';
import { projectCanonicalSearch } from './projectFromCanonical';
import {
  buildProviderSearches,
  type ProviderHandoffOptions,
} from './providerHandoff';
import type {
  CanonicalSearchProjection,
  ProviderLaunchResult,
  ProviderLaunchStatus,
  SearchLaunchSession,
} from './types';

export type { ProviderLaunchResult, ProviderLaunchStatus, SearchLaunchSession };

let activationCount = 0;
let lastActivationId: number | null = null;
let activeLaunchSession: SearchLaunchSession | null = null;

export function getLiveSearchActivationCount(): number {
  return activationCount;
}

export function getLastLiveSearchActivationId(): number | null {
  return lastActivationId;
}

export function resetLiveSearchActivationTracking(): void {
  activationCount = 0;
  lastActivationId = null;
  activeLaunchSession = null;
}

export function getActiveSearchLaunchSession(): SearchLaunchSession | null {
  return activeLaunchSession;
}

export function providerDisplayName(service: TravelServiceKind): string {
  if (service === 'flights') return 'Skyscanner';
  if (service === 'accommodation') return 'Booking.com';
  if (service === 'car_hire') return 'Skyscanner Car Hire';
  return service.replace(/_/g, ' ');
}

function serviceLabel(service: TravelServiceKind): string {
  if (service === 'car_hire') return 'car hire';
  if (service === 'accommodation') return 'accommodation';
  if (service === 'flights') return 'flight';
  return service.replace(/_/g, ' ');
}

/**
 * Attempt one provider open from the current call stack (must be a user gesture).
 * Does not use noopener so a Window reference can verify success.
 */
export function tryOpenProviderUrl(url: string): {
  opened: boolean;
  reason?: string;
} {
  if (typeof window === 'undefined') {
    return { opened: false, reason: 'No browser window available.' };
  }
  try {
    const win = window.open(url, '_blank');
    if (win) return { opened: true };
    return { opened: false, reason: 'Browser blocked the popup.' };
  } catch (error) {
    return {
      opened: false,
      reason: error instanceof Error ? error.message : 'Failed to open provider.',
    };
  }
}

export type LaunchProviderOptions = ProviderHandoffOptions & {
  /**
   * When true (default in browser activations), attempt to open the first
   * projected search from the current user gesture. Never opens more than one.
   */
  openFirst?: boolean;
};

export type ProviderLaunchBatch = {
  projection: CanonicalSearchProjection;
  results: ProviderLaunchResult[];
  activationId: number;
  session: SearchLaunchSession;
};

/**
 * Project provider URLs and launch safely:
 * - 0 automatic opens when openFirst is false
 * - at most 1 automatic open when openFirst is true
 * - remaining services → ready_for_user for explicit clicks
 */
export function launchProviderSearches(
  state: ConversationState,
  services: TravelServiceKind[],
  options?: LaunchProviderOptions,
): ProviderLaunchBatch {
  const projection = projectCanonicalSearch(state);
  const target = services.length > 0 ? services : projection.services;
  const openFirst = options?.openFirst === true;

  const handoff = buildProviderSearches(projection, target, {
    currency: options?.currency,
    cabinClass: options?.cabinClass,
    accommodationQuery:
      options?.accommodationQuery ?? state.accommodationArea?.value,
  });

  activationCount += 1;
  const activationId = activationCount;
  lastActivationId = activationId;

  const results: ProviderLaunchResult[] = [];
  let openedOne = false;

  for (const unavailable of handoff.unavailable) {
    results.push({
      service: unavailable.service,
      provider: providerDisplayName(unavailable.service),
      url: '',
      status: 'failed',
      reason: unavailable.reason,
    });
  }

  for (const search of handoff.searches) {
    const base: ProviderLaunchResult = {
      service: search.service,
      provider: providerDisplayName(search.service),
      url: search.url,
      status: 'ready_for_user',
      destinationLabel:
        search.destinationLabel ??
        search.destinationCode ??
        projection.destination.label,
      departDate: search.departDate,
      returnDate: search.returnDate,
    };

    // Preserve already-opened providers in an active session (avoid duplicates).
    const prior = activeLaunchSession?.results.find(
      (r) => r.service === search.service && r.status === 'opened' && r.url === search.url,
    );
    if (prior) {
      results.push({ ...base, status: 'opened' });
      continue;
    }

    if (openFirst && !openedOne) {
      const attempt = tryOpenProviderUrl(search.url);
      if (attempt.opened) {
        results.push({ ...base, status: 'opened' });
        openedOne = true;
        continue;
      }
      // Could not verify open — keep as ready_for_user (explicit button), not optimistic opened.
      results.push({
        ...base,
        status: 'ready_for_user',
        reason: attempt.reason,
      });
      openedOne = true; // do not attempt another automatic open
      continue;
    }

    results.push(base);
  }

  const session: SearchLaunchSession = {
    id: `launch-${activationId}`,
    activationId,
    createdAt: new Date().toISOString(),
    conversationId: state.conversationId,
    projection,
    results,
  };
  activeLaunchSession = session;

  return { projection, results, activationId, session };
}

/** Explicit Open button — one gesture, one provider. */
export function openProviderLaunchAction(
  service: TravelServiceKind,
): ProviderLaunchResult | null {
  const session = activeLaunchSession;
  if (!session) return null;
  const index = session.results.findIndex((r) => r.service === service);
  if (index < 0) return null;
  const current = session.results[index]!;
  if (!current.url) {
    const failed: ProviderLaunchResult = {
      ...current,
      status: 'failed',
      reason: current.reason ?? 'No provider URL available.',
    };
    session.results[index] = failed;
    return failed;
  }
  if (current.status === 'opened') return current;

  const attempt = tryOpenProviderUrl(current.url);
  const next: ProviderLaunchResult = attempt.opened
    ? { ...current, status: 'opened', reason: undefined }
    : {
        ...current,
        status: 'blocked',
        reason: attempt.reason ?? 'Browser blocked the popup.',
      };
  session.results[index] = next;
  activeLaunchSession = { ...session, results: [...session.results] };
  return next;
}

export function summarizeLaunchResults(results: ProviderLaunchResult[]): {
  openedServices: TravelServiceKind[];
  readyForUserServices: TravelServiceKind[];
  blockedServices: TravelServiceKind[];
  failedServices: TravelServiceKind[];
} {
  return {
    openedServices: results.filter((r) => r.status === 'opened').map((r) => r.service),
    readyForUserServices: results
      .filter((r) => r.status === 'ready_for_user')
      .map((r) => r.service),
    blockedServices: results.filter((r) => r.status === 'blocked').map((r) => r.service),
    failedServices: results.filter((r) => r.status === 'failed').map((r) => r.service),
  };
}

export function describeProviderLaunchReply(
  results: ProviderLaunchResult[],
): string {
  const { openedServices, readyForUserServices, blockedServices, failedServices } =
    summarizeLaunchResults(results);

  const labelList = (services: TravelServiceKind[]) => {
    const labels = services.map((s) => {
      if (s === 'flights') return 'flight';
      if (s === 'accommodation') return 'accommodation';
      if (s === 'car_hire') return 'car-hire';
      return serviceLabel(s);
    });
    if (labels.length <= 1) return labels[0] ?? '';
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
  };

  const parts: string[] = [];

  if (
    openedServices.length === results.length &&
    results.length > 0 &&
    blockedServices.length === 0 &&
    failedServices.length === 0 &&
    readyForUserServices.length === 0
  ) {
    if (results.length === 1 && results[0]?.service === 'flights') {
      return 'I’ve opened your flight search.';
    }
    return `I’ve opened your ${labelList(openedServices)} searches.`;
  }

  if (openedServices.length && readyForUserServices.length) {
    parts.push(
      `I’ve opened your ${labelList(openedServices)} search${openedServices.length > 1 ? 'es' : ''}.`,
    );
    parts.push(
      `Your ${labelList(readyForUserServices)} search${readyForUserServices.length > 1 ? 'es are' : ' is'} ready below.`,
    );
    return parts.join(' ');
  }

  if (!openedServices.length && readyForUserServices.length === results.length) {
    return `Your ${labelList(readyForUserServices)} searches are ready. Open each option below.`;
  }

  if (readyForUserServices.length && !openedServices.length) {
    parts.push(
      `Your ${labelList(readyForUserServices)} searches are ready. Open each option below.`,
    );
  }

  if (openedServices.length && !readyForUserServices.length) {
    parts.push(
      `I’ve opened your ${labelList(openedServices)} search${openedServices.length > 1 ? 'es' : ''}.`,
    );
  }

  if (blockedServices.length) {
    parts.push(
      `Your ${labelList(blockedServices)} search${blockedServices.length > 1 ? 'es were' : ' was'} blocked by the browser — use the Open button${blockedServices.length > 1 ? 's' : ''} below.`,
    );
  }

  if (failedServices.length) {
    const reasons = results
      .filter((r) => r.status === 'failed')
      .map((r) => `${serviceLabel(r.service)}: ${r.reason ?? 'unavailable'}`)
      .join('; ');
    parts.push(`Couldn’t prepare ${labelList(failedServices)} (${reasons}).`);
  }

  return parts.join(' ') || 'Your searches are ready below.';
}

/** Default launcher used by the conversation turn (browser-safe). */
export function defaultProviderLauncher(
  state: ConversationState,
  services: TravelServiceKind[],
  options?: LaunchProviderOptions,
): ProviderLaunchResult[] {
  const inBrowser = typeof window !== 'undefined';
  return launchProviderSearches(state, services, {
    ...options,
    // Only attempt the first open when a real browser gesture context exists.
    openFirst: options?.openFirst ?? inBrowser,
  }).results;
}
