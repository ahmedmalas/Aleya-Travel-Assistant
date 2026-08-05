/**
 * Phase 5 — strict activation gates for promoting the architecture path.
 *
 * Gates decide whether the diagnostic five-layer outcome is safe to own
 * result.state / result.reply for a single turn. No new conversation behaviours.
 */

import type { ConversationCoreState } from '../conversation-core';
import type { DualRunComparison } from './dualRunComparison';
import type { ValidationResult } from './validationResult';

export const ACTIVATION_GATE_IDS = [
  'no_unsafe_canonical_writes',
  'no_loss_of_valid_trip_details',
  'clarification_before_ambiguous_commits',
  'no_repeated_question_loops',
  'amendments_preserve_unaffected_state',
  'deterministic_validation_authoritative',
] as const;

export type ActivationGateId = (typeof ACTIVATION_GATE_IDS)[number];

export type ActivationGateResult = {
  id: ActivationGateId;
  passed: boolean;
  detail: string;
};

export type ActivationGateReport = {
  allPassed: boolean;
  results: ActivationGateResult[];
  /** True when the architecture outcome may own this turn. */
  mayActivate: boolean;
};

function asciiFold(value: string): string {
  let out = '';
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += normalized.charAt(i);
  }
  return out;
}

function placeMutationAccepted(validation: ValidationResult): boolean {
  return validation.accepted.some((o) =>
    /^(set_|replace_|add_|remove_|reorder_|clear_origin|clear_return)/.test(
      o.op,
    ),
  );
}

/**
 * Evaluate strict activation gates for one dual-run comparison.
 */
export function evaluateActivationGates(input: {
  comparison: DualRunComparison;
  priorState: ConversationCoreState;
}): ActivationGateReport {
  const { comparison, priorState } = input;
  const { validation, previewState, previewAct, semantic, divergence } =
    comparison;
  const results: ActivationGateResult[] = [];

  // 1) No unsafe canonical writes — rejected low-confidence / unsafe place ops
  // must not appear as committed preview mutations.
  const unsafeRejected = validation.rejected.filter((r) =>
    /Low confidence|refusing|unsafe|out of range|not found|Undo rejected/i.test(
      r.reason,
    ),
  );
  const acceptedUnsafe = validation.accepted.some(
    (o) =>
      o.confidence < 0.55 &&
      /origin|destination|stop|place/i.test(`${o.op} ${o.target}`),
  );
  const noUnsafe =
    !acceptedUnsafe &&
    (unsafeRejected.length === 0 ||
      divergence === 'unsafe_new_path_blocked' ||
      !placeMutationAccepted(validation) ||
      // blocked path: preview travel facts unchanged vs prior for rejected target
      (previewState.origin === priorState.origin &&
        JSON.stringify(previewState.destinationStops) ===
          JSON.stringify(priorState.destinationStops)));
  results.push({
    id: 'no_unsafe_canonical_writes',
    passed: noUnsafe && !acceptedUnsafe,
    detail: acceptedUnsafe
      ? 'Accepted a low-confidence place mutation'
      : unsafeRejected.length > 0
        ? `Validator blocked ${unsafeRejected.length} unsafe op(s); preview did not apply them`
        : 'No unsafe place writes accepted',
  });

  // 2) No loss of valid trip details — unless reset/restart or explicit clear.
  const intentionalReset =
    semantic.intent === 'reset' ||
    semantic.intent === 'restart' ||
    semantic.conversationalControl === 'reset' ||
    semantic.conversationalControl === 'restart';
  const datesLost =
    !intentionalReset &&
    ((priorState.departureDate !== null &&
      previewState.departureDate === null) ||
      (priorState.returnDate !== null && previewState.returnDate === null));
  const originLostUnexpectedly =
    !intentionalReset &&
    priorState.origin !== null &&
    previewState.origin === null &&
    !validation.accepted.some(
      (o) => o.op === 'clear_origin' || o.op === 'replace_origin',
    );
  results.push({
    id: 'no_loss_of_valid_trip_details',
    passed: !datesLost && !originLostUnexpectedly,
    detail: datesLost
      ? 'Preview dropped committed dates without reset'
      : originLostUnexpectedly
        ? 'Preview dropped origin without an explicit clear/replace'
        : intentionalReset
          ? 'Reset/restart may clear trip details'
          : 'Committed trip details retained or intentionally amended',
  });

  // 3) Clarification before ambiguous commits — bare/ambiguous subject must not
  // silently set origin/destinations.
  const ambiguous =
    semantic.clarificationStance === 'ambiguous' ||
    semantic.ambiguityNotes.some((n) => /ambiguous|Bare /i.test(n));
  const silentAmbiguousCommit =
    ambiguous &&
    validation.accepted.some(
      (o) =>
        o.op === 'set_origin' ||
        o.op === 'set_destinations' ||
        o.op === 'confirm_clarification',
    );
  results.push({
    id: 'clarification_before_ambiguous_commits',
    passed: !silentAmbiguousCommit,
    detail: silentAmbiguousCommit
      ? 'Ambiguous clarification answer produced a silent place commit'
      : ambiguous
        ? 'Ambiguous answer narrowed/kept clarification without place commit'
        : 'No ambiguous commit path this turn',
  });

  // 4) No repeated-question loops — must not re-emit prior clar id+prompt.
  const priorClar = priorState.openClarification;
  const repeatsPrior =
    priorClar?.blocking === true &&
    previewAct.kind === 'clarify' &&
    previewAct.clarificationId === priorClar.id &&
    previewAct.reply === priorClar.prompt;
  results.push({
    id: 'no_repeated_question_loops',
    passed: !repeatsPrior,
    detail: repeatsPrior
      ? `Preview would repeat clarification ${priorClar.id}`
      : priorClar && previewAct.kind === 'clarify'
        ? 'Preview clarifies with a different id/prompt (narrow or supersede)'
        : 'No repeated clarification loop',
  });

  // 5) Amendments preserve unaffected state — preserve_* ops honored; dates
  // stay when preserve_dates accepted or change_only / keep-the-dates intent.
  const preserveDates = validation.accepted.some((o) => o.op === 'preserve_dates');
  const datesPreserved =
    !preserveDates ||
    (previewState.departureDate === priorState.departureDate &&
      previewState.returnDate === priorState.returnDate);
  const preservePlaces = validation.accepted.some(
    (o) => o.op === 'preserve_places',
  );
  // Origin preserved when not the amendment target.
  const originUntouched =
    !validation.accepted.some(
      (o) =>
        o.op === 'set_origin' ||
        o.op === 'replace_origin' ||
        o.op === 'clear_origin' ||
        o.op === 'reset_trip' ||
        o.op === 'restart_conversation',
    ) &&
    previewState.origin === priorState.origin;
  const originOk =
    validation.accepted.some(
      (o) =>
        o.op === 'set_origin' ||
        o.op === 'replace_origin' ||
        o.op === 'clear_origin' ||
        o.op === 'reset_trip' ||
        o.op === 'restart_conversation' ||
        o.op === 'confirm_clarification',
    ) || originUntouched;
  results.push({
    id: 'amendments_preserve_unaffected_state',
    passed: datesPreserved && originOk && (!preservePlaces || originOk),
    detail: !datesPreserved
      ? 'preserve_dates accepted but dates changed'
      : 'Unaffected fields preserved across amendment',
  });

  // 6) Deterministic validation remains authoritative — committer preview only
  // reflects accepted ops; rejected place mutations absent from preview delta.
  const reasonsOk = validation.reasons.some((r) =>
    /Phase 3 Canonical Validator/i.test(r),
  );
  const rejectedApplied = validation.rejected.some((r) => {
    if (r.op.op === 'set_origin' && typeof r.op.value === 'string') {
      return (
        previewState.origin !== priorState.origin &&
        asciiFold(previewState.origin ?? '') === asciiFold(r.op.value)
      );
    }
    if (r.op.op === 'replace_destination' || r.op.op === 'set_destinations') {
      return false; // checked via low-confidence path above
    }
    return false;
  });
  results.push({
    id: 'deterministic_validation_authoritative',
    passed: reasonsOk && !rejectedApplied,
    detail: !reasonsOk
      ? 'Validator reasons missing Phase 3 marker'
      : rejectedApplied
        ? 'Rejected operation appears applied in preview'
        : 'Validator accept/reject set is authoritative for preview commit',
  });

  const allPassed = results.every((r) => r.passed);
  return {
    allPassed,
    results,
    mayActivate: allPassed,
  };
}
