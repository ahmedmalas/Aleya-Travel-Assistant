/**
 * Phase 5 — run the five-layer architecture pipeline once.
 * Pure diagnostic/preview computation; caller decides whether to activate.
 */

import type { ConversationCoreState } from '../conversation-core';
import {
  choosePreviewConsultantAct,
  type PreviewConsultantAct,
} from './choosePreviewConsultantAct';
import {
  commitCanonicalOperations,
  type CommitCanonicalOperationsResult,
} from './commitCanonicalOperations';
import { interpretDiagnosticSemantic } from './interpretDiagnosticSemantic';
import { planCanonicalOperations } from './planCanonicalOperations';
import type { PlannerResult } from './canonicalOperations';
import type { SemanticInterpretation } from './semanticInterpretation';
import { validateCanonicalOperations } from './validateCanonicalOperations';
import type { ValidationResult } from './validationResult';

export type ArchitecturePipelineResult = {
  semantic: SemanticInterpretation;
  planner: PlannerResult;
  validation: ValidationResult;
  committed: CommitCanonicalOperationsResult;
  previewAct: PreviewConsultantAct;
};

export function runArchitecturePipeline(input: {
  message: string;
  currentState: ConversationCoreState;
  semantic?: SemanticInterpretation;
}): ArchitecturePipelineResult {
  const semantic =
    input.semantic ??
    interpretDiagnosticSemantic({
      message: input.message,
      currentState: input.currentState,
    });

  const planner = planCanonicalOperations({
    semantic,
    currentState: input.currentState,
  });

  const validation = validateCanonicalOperations({
    operations: planner.operations,
    currentState: input.currentState,
  });

  const committed = commitCanonicalOperations({
    currentState: input.currentState,
    accepted: validation.accepted,
    clarificationAction: validation.clarificationAction,
    narrowedClarification: validation.narrowedClarification,
  });

  const previewAct = choosePreviewConsultantAct({
    previewState: committed.state,
    validation,
    semantic,
    clearedClarificationIds: committed.clearedClarificationIds,
    priorClarificationId: input.currentState.openClarification?.id ?? null,
  });

  return { semantic, planner, validation, committed, previewAct };
}
