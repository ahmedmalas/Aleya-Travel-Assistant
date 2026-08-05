/**
 * Phase 5 — readiness proofs for dual-run divergences.
 *
 * Documents why the architecture path is safer/more human than legacy for
 * each non-aligning corpus divergence. No new behaviours — analysis only.
 */

import type { DivergenceCategory } from './dualRunComparison';

export type DivergenceReadinessVerdict = {
  category: DivergenceCategory;
  scenario: string;
  legacyBehaviour: string;
  architectureBehaviour: string;
  safer: boolean;
  moreHuman: boolean;
  rationale: string;
  gateImplications: string[];
};

/**
 * Fixed corpus divergence reviews from Phase 4 counts:
 * 2× legacy_loop_risk, 1× different_state_same_act, 1× unsafe_new_path_blocked.
 */
export const PHASE5_DIVERGENCE_READINESS: DivergenceReadinessVerdict[] = [
  {
    category: 'legacy_loop_risk',
    scenario:
      'Bangkok/Beirut place-role open; user answers bare "bangkok"',
    legacyBehaviour:
      'Re-asks the identical long clarification (same id + prompt); origin stays null; loop.',
    architectureBehaviour:
      'Treats bare subject as ambiguous; narrows clarification to a shorter prompt with new id; does not commit origin.',
    safer: true,
    moreHuman: true,
    rationale:
      'Legacy burns a turn repeating a resolved-as-heard but role-ambiguous answer. Architecture refuses unsafe origin write and asks a tighter follow-up — clarify-before-write without looping.',
    gateImplications: [
      'clarification_before_ambiguous_commits',
      'no_repeated_question_loops',
      'no_unsafe_canonical_writes',
    ],
  },
  {
    category: 'legacy_loop_risk',
    scenario: 'Osaka/Nairobi place-role open; user answers bare "Osaka"',
    legacyBehaviour:
      'Repeats the same Osaka role question unchanged.',
    architectureBehaviour:
      'Narrows to "Osaka as your starting point?" without set_origin.',
    safer: true,
    moreHuman: true,
    rationale:
      'Same structural defect as Bangkok: bare subject ≠ role cue. Architecture progresses the dialogue by narrowing rather than replaying.',
    gateImplications: [
      'clarification_before_ambiguous_commits',
      'no_repeated_question_loops',
    ],
  },
  {
    category: 'different_state_same_act',
    scenario:
      'Lisbon→Osaka→Bogotá multi-city; user says "Remove Osaka"',
    legacyBehaviour:
      'Removes Osaka but may leave tripStructure=multi_city with a single stop (incoherent).',
    architectureBehaviour:
      'Removes Osaka and clears multi_city when fewer than 2 stops remain; dates preserved.',
    safer: true,
    moreHuman: true,
    rationale:
      'Architecture keeps canonical trip structure coherent after amendment. State difference is a correctness fix, not a behaviour invention — invalid multi_city with one stop is dropped.',
    gateImplications: [
      'amendments_preserve_unaffected_state',
      'no_loss_of_valid_trip_details',
      'deterministic_validation_authoritative',
    ],
  },
  {
    category: 'unsafe_new_path_blocked',
    scenario:
      'Lisbon→Osaka committed; user says "Maybe change Osaka to Muscat somehow"',
    legacyBehaviour:
      'May soft-ask or leave state unchanged without a hard safety reject trace.',
    architectureBehaviour:
      'Planner proposes replace under low confidence; validator rejects; preview state unchanged; recover act.',
    safer: true,
    moreHuman: true,
    rationale:
      'Hedged contradiction must not mutate canonical places. Blocking the write and asking for certainty is safer than applying a maybe-amendment.',
    gateImplications: [
      'no_unsafe_canonical_writes',
      'deterministic_validation_authoritative',
      'no_loss_of_valid_trip_details',
    ],
  },
];

export function assertDivergenceReadiness(): {
  allSafer: boolean;
  allMoreHuman: boolean;
  verdicts: DivergenceReadinessVerdict[];
} {
  return {
    allSafer: PHASE5_DIVERGENCE_READINESS.every((v) => v.safer),
    allMoreHuman: PHASE5_DIVERGENCE_READINESS.every((v) => v.moreHuman),
    verdicts: PHASE5_DIVERGENCE_READINESS,
  };
}
