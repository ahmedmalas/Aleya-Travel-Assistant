/**
 * Dialogue Reasoner — domain-agnostic conversational relationship.
 *
 * Must not import travel types or reason about travel domain fields.
 * Emits a closed DialogueDecision that constrains the Domain Planner.
 */

import type { SemanticInterpretation } from '../semanticInterpretation';
import {
  awaitingObligations,
  primaryAwaitingObligation,
} from './dialogueState';
import type {
  DialogueDecision,
  DialogueState,
  TurnContribution,
  ValueClass,
} from './dialogueTypes';
import { contributionMatchesExpect } from './turnContributions';

export type ReasonDialogueInput = {
  dialogueState: DialogueState;
  contributions: TurnContribution[];
  semantic: SemanticInterpretation;
  /** Blocking clarification present — dialogue yields to clarify-for-write. */
  hasBlockingClarification: boolean;
};

function hasClass(
  contributions: TurnContribution[],
  valueClass: ValueClass,
): boolean {
  return contributions.some((c) => c.valueClasses.includes(valueClass));
}

function matchingContributions(
  contributions: TurnContribution[],
  expect: ValueClass[],
): TurnContribution[] {
  return contributions.filter((c) => contributionMatchesExpect(c, expect));
}

function isRestart(semantic: SemanticInterpretation): boolean {
  return (
    semantic.intent === 'reset' ||
    semantic.intent === 'restart' ||
    semantic.conversationalControl === 'reset' ||
    semantic.conversationalControl === 'restart'
  );
}

function isConfirm(semantic: SemanticInterpretation): boolean {
  return (
    semantic.intent === 'confirm' ||
    semantic.deltas.some((d) => d.kind === 'confirm_option')
  );
}

function isDecline(semantic: SemanticInterpretation): boolean {
  return (
    semantic.intent === 'reject' ||
    semantic.deltas.some(
      (d) => d.kind === 'reject_option' || d.kind === 'reject_framing',
    )
  );
}

function isAmend(semantic: SemanticInterpretation): boolean {
  return (
    semantic.intent === 'correct' ||
    semantic.intent === 'remove' ||
    semantic.intent === 'add' ||
    semantic.intent === 'replace_route' ||
    semantic.deltas.some(
      (d) =>
        d.kind === 'remove_place' ||
        d.kind === 'replace_place' ||
        d.kind === 'reorder_places',
    )
  );
}

function isPremiseCorrection(semantic: SemanticInterpretation): boolean {
  return (
    semantic.clarificationStance === 'corrects_premise' ||
    semantic.deltas.some((d) => d.kind === 'reject_framing')
  );
}

function isAmbiguousStance(semantic: SemanticInterpretation): boolean {
  return (
    semantic.clarificationStance === 'ambiguous' ||
    semantic.ambiguityNotes.length > 0 ||
    semantic.confidence > 0 && semantic.confidence < 0.45
  );
}

/**
 * Classify conversational relationship. Pure and deterministic.
 */
export function reasonDialogue(
  input: ReasonDialogueInput,
): DialogueDecision {
  const { dialogueState, contributions, semantic, hasBlockingClarification } =
    input;
  const notes: string[] = [];
  const awaiting = awaitingObligations(dialogueState);
  const primary = primaryAwaitingObligation(dialogueState);
  const confidence = semantic.confidence;

  if (hasBlockingClarification) {
    notes.push('Blocking clarification present — dialogue yields');
    // Clarification path still classifies answer vs ambiguous vs unrelated.
    if (semantic.clarificationStance === 'answers') {
      return {
        event: 'answered_previous_move',
        confidence,
        satisfiedObligationIds: primary ? [primary.id] : [],
        deferredObligationIds: [],
        supersededObligationIds: [],
        planningMode: 'apply_bound_contributions',
        contributionPolicy: 'bound_answers_preferred',
        ambiguity: 'none',
        boundContributionRefs: contributions.map((c) => ({ id: c.id })),
        notes,
      };
    }
    if (
      semantic.clarificationStance === 'ambiguous' ||
      semantic.clarificationStance === 'narrows'
    ) {
      return {
        event: 'ambiguous_relation',
        confidence,
        satisfiedObligationIds: [],
        deferredObligationIds: primary ? [primary.id] : [],
        supersededObligationIds: [],
        planningMode: 'hold_for_clarification',
        contributionPolicy: 'disallow_unrelated_writes',
        ambiguity: 'require_clarification',
        boundContributionRefs: [],
        notes,
      };
    }
    if (semantic.clarificationStance === 'corrects_premise') {
      return {
        event: 'corrected_premise',
        confidence,
        satisfiedObligationIds: [],
        deferredObligationIds: [],
        supersededObligationIds: primary ? [primary.id] : [],
        planningMode: 'apply_premise_correction',
        contributionPolicy: 'allow_additional_clear_facts',
        ambiguity: 'none',
        boundContributionRefs: contributions.map((c) => ({ id: c.id })),
        notes,
      };
    }
  }

  if (isRestart(semantic)) {
    notes.push('Restart/reset control');
    return {
      event: 'restarted',
      confidence,
      satisfiedObligationIds: [],
      deferredObligationIds: [],
      supersededObligationIds: awaiting.map((o) => o.id),
      planningMode: 'apply_restart',
      contributionPolicy: 'disallow_unrelated_writes',
      ambiguity: 'none',
      boundContributionRefs: [],
      notes,
    };
  }

  if (!dialogueState.lastMove && awaiting.length === 0) {
    notes.push('No prior move — open contribution');
    if (isAmbiguousStance(semantic) && contributions.length > 0) {
      return {
        event: 'ambiguous_relation',
        confidence,
        satisfiedObligationIds: [],
        deferredObligationIds: [],
        supersededObligationIds: [],
        planningMode: 'hold_for_clarification',
        contributionPolicy: 'disallow_unrelated_writes',
        ambiguity: 'require_clarification',
        boundContributionRefs: [],
        notes,
      };
    }
    return {
      event: 'no_prior_move',
      confidence,
      satisfiedObligationIds: [],
      deferredObligationIds: [],
      supersededObligationIds: [],
      planningMode: 'apply_contributions_only',
      contributionPolicy: 'allow_additional_clear_facts',
      ambiguity: 'none',
      boundContributionRefs: contributions.map((c) => ({ id: c.id })),
      notes,
    };
  }

  if (isPremiseCorrection(semantic)) {
    notes.push('Premise correction relative to prior framing');
    return {
      event: 'corrected_premise',
      confidence,
      satisfiedObligationIds: [],
      deferredObligationIds: [],
      supersededObligationIds: awaiting.map((o) => o.id),
      planningMode: 'apply_premise_correction',
      contributionPolicy: 'allow_additional_clear_facts',
      ambiguity: 'none',
      boundContributionRefs: contributions.map((c) => ({ id: c.id })),
      notes,
    };
  }

  // Confirm / decline when last move expects BooleanConfirm or confirm thread.
  const expectsConfirm =
    primary?.expectValueClasses.includes('BooleanConfirm') === true ||
    dialogueState.openThread.kind === 'confirm' ||
    dialogueState.lastMove?.kind === 'confirm' ||
    dialogueState.lastMove?.kind === 'summarise';

  if (expectsConfirm && isConfirm(semantic) && !isAmend(semantic)) {
    notes.push('Confirmation of prior confirm/summarise move');
    return {
      event: 'confirmed',
      confidence,
      satisfiedObligationIds: primary ? [primary.id] : [],
      deferredObligationIds: [],
      supersededObligationIds: [],
      planningMode: 'apply_confirmation',
      contributionPolicy: 'bound_answers_preferred',
      ambiguity: 'none',
      boundContributionRefs: contributions.map((c) => ({ id: c.id })),
      notes,
    };
  }

  if (expectsConfirm && isDecline(semantic)) {
    notes.push('Decline of prior confirm move');
    return {
      event: 'declined',
      confidence,
      satisfiedObligationIds: [],
      deferredObligationIds: [],
      supersededObligationIds: primary ? [primary.id] : [],
      planningMode: 'apply_decline',
      contributionPolicy: 'disallow_unrelated_writes',
      ambiguity: 'none',
      boundContributionRefs: [],
      notes,
    };
  }

  if (isAmend(semantic) && !isConfirm(semantic)) {
    notes.push('Amendment / correction of prior information');
    const matches = primary
      ? matchingContributions(contributions, primary.expectValueClasses)
      : [];
    const alsoAnswers = matches.length > 0;
    return {
      event: alsoAnswers ? 'compound_response' : 'amended_prior_information',
      confidence,
      satisfiedObligationIds: alsoAnswers && primary ? [primary.id] : [],
      deferredObligationIds:
        !alsoAnswers && primary ? [primary.id] : [],
      supersededObligationIds: [],
      planningMode: alsoAnswers
        ? 'apply_bound_contributions'
        : 'apply_amendments',
      contributionPolicy: alsoAnswers
        ? 'bound_answers_preferred'
        : 'amendments_only',
      ambiguity: 'none',
      boundContributionRefs: alsoAnswers
        ? matches.map((c) => ({ id: c.id }))
        : contributions.map((c) => ({ id: c.id })),
      notes,
    };
  }

  if (primary) {
    const matches = matchingContributions(
      contributions,
      primary.expectValueClasses,
    );
    const unmatched = contributions.filter((c) => !matches.includes(c));

    if (matches.length === 0 && contributions.length === 0) {
      if (isAmbiguousStance(semantic)) {
        return {
          event: 'ambiguous_relation',
          confidence,
          satisfiedObligationIds: [],
          deferredObligationIds: [primary.id],
          supersededObligationIds: [],
          planningMode: 'hold_for_clarification',
          contributionPolicy: 'disallow_unrelated_writes',
          ambiguity: 'require_recovery_prompt',
          boundContributionRefs: [],
          notes: [...notes, 'Empty contribution under awaiting obligation'],
        };
      }
      // Empty / non-matching — defer obligation, no mutation.
      return {
        event: 'ignored_move_with_contribution',
        confidence,
        satisfiedObligationIds: [],
        deferredObligationIds: [primary.id],
        supersededObligationIds: [],
        planningMode: 'no_domain_mutation',
        contributionPolicy: 'disallow_unrelated_writes',
        ambiguity: 'none',
        boundContributionRefs: [],
        notes: [...notes, 'No contributions; obligation deferred'],
      };
    }

    if (matches.length === 0 && unmatched.length > 0) {
      // Useful diversion: contributions don't match expected class.
      notes.push(
        'Contributions present but do not match awaiting expect classes',
      );
      if (isAmbiguousStance(semantic)) {
        return {
          event: 'ambiguous_relation',
          confidence,
          satisfiedObligationIds: [],
          deferredObligationIds: [primary.id],
          supersededObligationIds: [],
          planningMode: 'hold_for_clarification',
          contributionPolicy: 'disallow_unrelated_writes',
          ambiguity: 'require_clarification',
          boundContributionRefs: [],
          notes,
        };
      }
      return {
        event: 'ignored_move_with_contribution',
        confidence,
        satisfiedObligationIds: [],
        deferredObligationIds: [primary.id],
        supersededObligationIds: [],
        planningMode: 'apply_contributions_only',
        contributionPolicy: 'allow_additional_clear_facts',
        ambiguity: 'none',
        boundContributionRefs: unmatched.map((c) => ({ id: c.id })),
        notes,
      };
    }

    // Matches awaiting expect classes.
    if (unmatched.length > 0) {
      notes.push('Compound: answer + additional contributions');
      return {
        event: 'compound_response',
        confidence,
        satisfiedObligationIds: [primary.id],
        deferredObligationIds: [],
        supersededObligationIds: [],
        planningMode: 'apply_bound_contributions',
        contributionPolicy: 'bound_answers_preferred',
        ambiguity: 'none',
        boundContributionRefs: contributions.map((c) => ({ id: c.id })),
        notes,
      };
    }

    notes.push('Answered previous move via matching value class');
    return {
      event: 'answered_previous_move',
      confidence,
      satisfiedObligationIds: [primary.id],
      deferredObligationIds: [],
      supersededObligationIds: [],
      planningMode: 'apply_bound_contributions',
      contributionPolicy: 'bound_answers_preferred',
      ambiguity: 'none',
      boundContributionRefs: matches.map((c) => ({ id: c.id })),
      notes,
    };
  }

  // Contributions with no awaiting obligation — treat as open contribution / shift.
  if (contributions.length > 0) {
    notes.push('No awaiting obligation; open contribution');
    return {
      event: 'shifted_focus',
      confidence,
      satisfiedObligationIds: [],
      deferredObligationIds: [],
      supersededObligationIds: [],
      planningMode: 'apply_contributions_only',
      contributionPolicy: 'allow_additional_clear_facts',
      ambiguity: 'none',
      boundContributionRefs: contributions.map((c) => ({ id: c.id })),
      notes,
    };
  }

  return {
    event: 'no_prior_move',
    confidence,
    satisfiedObligationIds: [],
    deferredObligationIds: [],
    supersededObligationIds: [],
    planningMode: 'no_domain_mutation',
    contributionPolicy: 'disallow_unrelated_writes',
    ambiguity: 'none',
    boundContributionRefs: [],
    notes: [...notes, 'Idle — no contributions'],
  };
}
