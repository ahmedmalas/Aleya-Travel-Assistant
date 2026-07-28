import type { ActiveOptionSet } from './contextual-reference/types';

let pending: { optionSet: ActiveOptionSet; question: string } | null = null;

export function setPendingLocationAmbiguity(
  optionSet: ActiveOptionSet,
  question: string,
): void {
  pending = { optionSet, question };
}

export function consumePendingLocationAmbiguity(): {
  optionSet: ActiveOptionSet;
  question: string;
} | null {
  const value = pending;
  pending = null;
  return value;
}

export function peekPendingLocationAmbiguity(): {
  optionSet: ActiveOptionSet;
  question: string;
} | null {
  return pending;
}

export function clearPendingLocationAmbiguity(): void {
  pending = null;
}
