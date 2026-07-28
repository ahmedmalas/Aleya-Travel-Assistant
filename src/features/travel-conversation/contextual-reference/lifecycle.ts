/**
 * Active option-set lifecycle.
 *
 * Remains valid while the user answers the latest option-based Aleya question.
 * Replaced when a newer option set is presented.
 * Cleared on trip reset, topic change, search start, or when no longer applicable.
 */

import type { ActiveOptionSet } from './types';
import { resetOptionSetSequence } from './builders';

let activeOptionSet: ActiveOptionSet | null = null;

export function getActiveOptionSet(): ActiveOptionSet | null {
  return activeOptionSet;
}

export function setActiveOptionSet(next: ActiveOptionSet | null): void {
  activeOptionSet = next;
}

export function clearActiveOptionSet(): void {
  activeOptionSet = null;
}

export function replaceActiveOptionSet(next: ActiveOptionSet): void {
  activeOptionSet = next;
}

export function resetContextualReferenceRuntime(): void {
  activeOptionSet = null;
  resetOptionSetSequence();
}

/**
 * After a successful resolution against the current set, clear it so a later
 * deixis cannot bind to a stale question.
 */
export function consumeActiveOptionSetAfterResolution(): void {
  activeOptionSet = null;
}

/**
 * Drop the set when canonical state already satisfies the awaiting field
 * (e.g. services populated) or the set is no longer applicable.
 */
export function expireOptionSetIfInapplicable(input: {
  servicesCount: number;
  tripType?: 'one_way' | 'return';
}): void {
  const set = activeOptionSet;
  if (!set) return;
  if (set.awaitingField === 'services' && input.servicesCount > 0) {
    activeOptionSet = null;
    return;
  }
  if (set.awaitingField === 'tripType' && input.tripType) {
    activeOptionSet = null;
  }
}
