/**
 * Governor-side Dialogue State update after emitting a move.
 * Travel-aware only for sealing domainTarget onto new obligations —
 * the Reasoner never reads domainSealed.
 */

import type { PreviewConsultantAct } from '../choosePreviewConsultantAct';
import { cloneDialogueState } from './dialogueState';
import type {
  DialogueDecision,
  DialogueMoveKind,
  DialogueObligation,
  DialogueState,
  DialogueThreadKind,
  ValueClass,
} from './dialogueTypes';

function moveKindFromAct(act: PreviewConsultantAct): DialogueMoveKind {
  if (act.kind === 'acknowledge') return 'acknowledge';
  if (act.kind === 'recover') return 'recover';
  return act.kind as DialogueMoveKind;
}

function threadKindFromAct(act: PreviewConsultantAct): DialogueThreadKind {
  if (act.kind === 'clarify') return 'clarify';
  if (act.kind === 'confirm') return 'confirm';
  if (act.kind === 'amend' || act.kind === 'acknowledge') return 'amend';
  if (act.kind === 'execute') return 'book';
  if (act.kind === 'summarise') return 'confirm';
  if (act.kind === 'ask') return 'capture';
  return 'idle';
}

/**
 * Map ask topics / act kinds to abstract expect classes + sealed domain target.
 * This mapping is Travel Domain / Governor concern — not Dialogue Reasoner.
 */
export function expectClassesAndDomainForAct(act: PreviewConsultantAct): {
  expectValueClasses: ValueClass[];
  domainTarget: string | null;
  awaitsResponse: boolean;
} {
  if (act.kind === 'clarify' && act.clarification) {
    return {
      expectValueClasses: ['OptionChoice', 'PlaceLike', 'FreeText'],
      domainTarget: 'openClarification',
      awaitsResponse: true,
    };
  }
  if (act.kind === 'confirm' || act.kind === 'summarise') {
    return {
      expectValueClasses: ['BooleanConfirm'],
      domainTarget: 'search_confirmation',
      awaitsResponse: true,
    };
  }
  if (act.kind === 'execute' || act.kind === 'acknowledge' || act.kind === 'recover') {
    return {
      expectValueClasses: [],
      domainTarget: null,
      awaitsResponse: false,
    };
  }

  const topic = act.askTopic ?? null;
  switch (topic) {
    case 'origin':
      return {
        expectValueClasses: ['PlaceLike'],
        domainTarget: 'origin',
        awaitsResponse: true,
      };
    case 'destination':
    case 'destinationStops':
      return {
        expectValueClasses: ['PlaceLike'],
        domainTarget: topic,
        awaitsResponse: true,
      };
    case 'departureDate':
    case 'returnDate':
      return {
        expectValueClasses: ['TemporalLike'],
        domainTarget: topic,
        awaitsResponse: true,
      };
    case 'adultCount':
    case 'childCount':
    case 'infantCount':
      return {
        expectValueClasses: ['QuantityLike'],
        domainTarget: topic,
        awaitsResponse: true,
      };
    case 'services':
      return {
        expectValueClasses: ['ServiceLike'],
        domainTarget: 'services',
        awaitsResponse: true,
      };
    case 'optional':
      return {
        expectValueClasses: ['FreeText', 'PlaceLike', 'TemporalLike', 'ServiceLike'],
        domainTarget: 'optional',
        awaitsResponse: true,
      };
    default:
      return {
        expectValueClasses: ['FreeText'],
        domainTarget: topic,
        awaitsResponse: act.kind === 'ask',
      };
  }
}

export type UpdateDialogueStateInput = {
  prior: DialogueState;
  decision: DialogueDecision;
  act: PreviewConsultantAct;
  turnCount: number;
};

/**
 * Apply decision satisfaction/supersession, then record the new move/obligation.
 */
export function updateDialogueStateAfterAct(
  input: UpdateDialogueStateInput,
): DialogueState {
  const next = cloneDialogueState(input.prior);
  const { decision, act, turnCount } = input;

  const mark = (
    ids: string[],
    status: DialogueObligation['status'],
  ) => {
    for (const id of ids) {
      const obl = next.obligations.find((o) => o.id === id);
      if (obl) obl.status = status;
    }
  };

  mark(decision.satisfiedObligationIds, 'satisfied');
  mark(decision.deferredObligationIds, 'deferred');
  mark(decision.supersededObligationIds, 'superseded');

  // Deferred awaiting obligations stay awaiting (user didn't settle them).
  for (const id of decision.deferredObligationIds) {
    const obl = next.obligations.find((o) => o.id === id);
    if (obl && obl.status === 'deferred') {
      obl.status = 'awaiting';
    }
  }

  next.unresolvedDialogueMatters = next.unresolvedDialogueMatters.filter(
    (m) =>
      !decision.satisfiedObligationIds.some((id) =>
        m.relatedObligationIds.includes(id),
      ) &&
      !decision.supersededObligationIds.some((id) =>
        m.relatedObligationIds.includes(id),
      ),
  );

  if (decision.ambiguity !== 'none') {
    next.unresolvedDialogueMatters.push({
      id: `matter:ambiguity:${turnCount}`,
      kind: 'ambiguity',
      relatedObligationIds: decision.deferredObligationIds,
    });
  }

  if (decision.event === 'rejected_direction') {
    next.unresolvedDialogueMatters.push({
      id: `matter:rejected:${turnCount}`,
      kind: 'rejected_direction',
      relatedObligationIds: [],
    });
  }

  const { expectValueClasses, domainTarget, awaitsResponse } =
    expectClassesAndDomainForAct(act);
  const moveId = `move:${turnCount}:${act.kind}`;
  const obligationId = awaitsResponse ? `obl:${moveId}` : null;

  next.lastMove = {
    moveId,
    kind: moveKindFromAct(act),
    expectValueClasses,
    obligationId,
    promptFingerprint: act.reply.slice(0, 160),
    issuedAtTurn: turnCount,
  };

  next.openThread = {
    threadId: `thread:${threadKindFromAct(act)}:${turnCount}`,
    kind: threadKindFromAct(act),
    status: act.kind === 'clarify' ? 'active' : 'active',
  };

  if (act.clarification?.subject) {
    next.focus = { handle: act.clarification.subject };
  } else if (act.askTopic) {
    next.focus = { handle: act.askTopic };
  }

  // Suspend ordinary obligations while clarify is open.
  if (act.kind === 'clarify') {
    for (const obl of next.obligations) {
      if (obl.status === 'awaiting' && obl.id !== obligationId) {
        obl.status = 'deferred';
      }
    }
  }

  if (obligationId) {
    next.obligations.push({
      id: obligationId,
      sourceMoveId: moveId,
      expectValueClasses,
      status: 'awaiting',
      domainSealed: domainTarget ? { domainTarget } : {},
    });
  }

  return next;
}
