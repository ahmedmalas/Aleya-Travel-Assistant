/**
 * Dialogue State factory and pure helpers.
 * No travel domain knowledge.
 */

import type {
  DialogueObligation,
  DialogueState,
  DialogueThread,
} from './dialogueTypes';

export function createInitialDialogueState(
  overrides: Partial<DialogueState> = {},
): DialogueState {
  const openThread: DialogueThread = overrides.openThread ?? {
    threadId: 'thread:idle',
    kind: 'idle',
    status: 'active',
  };
  return {
    lastMove: overrides.lastMove ?? null,
    openThread,
    focus: overrides.focus ?? null,
    obligations: overrides.obligations ? [...overrides.obligations] : [],
    unresolvedDialogueMatters: overrides.unresolvedDialogueMatters
      ? [...overrides.unresolvedDialogueMatters]
      : [],
  };
}

export function cloneDialogueState(state: DialogueState): DialogueState {
  return {
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    openThread: { ...state.openThread },
    focus: state.focus ? { ...state.focus } : null,
    obligations: state.obligations.map((o) => ({
      ...o,
      expectValueClasses: [...o.expectValueClasses],
      domainSealed: { ...o.domainSealed },
    })),
    unresolvedDialogueMatters: state.unresolvedDialogueMatters.map((m) => ({
      ...m,
      relatedObligationIds: [...m.relatedObligationIds],
    })),
  };
}

export function awaitingObligations(
  state: DialogueState,
): DialogueObligation[] {
  return state.obligations.filter((o) => o.status === 'awaiting');
}

export function primaryAwaitingObligation(
  state: DialogueState,
): DialogueObligation | null {
  const fromLast =
    state.lastMove?.obligationId != null
      ? state.obligations.find(
          (o) =>
            o.id === state.lastMove!.obligationId && o.status === 'awaiting',
        )
      : null;
  if (fromLast) return fromLast;
  return awaitingObligations(state)[0] ?? null;
}
