/**
 * Architecture pipeline with Dialogue Layer between Situation and Travel Planner.
 *
 * Semantic → Turn contributions (Situation bridge) → Dialogue Reasoner
 * → Travel Domain Planner → Validator → Committer → Governor preview
 * → Dialogue State update.
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
import {
  createInitialDialogueState,
  type DialogueDecision,
  type DialogueState,
  type TurnContribution,
} from './dialogue';
import { reasonDialogue } from './dialogue/dialogueReasoner';
import { buildTurnContributions } from './dialogue/turnContributions';
import { updateDialogueStateAfterAct } from './dialogue/updateDialogueStateAfterAct';
import { interpretDiagnosticSemantic } from './interpretDiagnosticSemantic';
import { planCanonicalOperations } from './planCanonicalOperations';
import type { PlannerResult } from './canonicalOperations';
import type { SemanticInterpretation } from './semanticInterpretation';
import { validateCanonicalOperations } from './validateCanonicalOperations';
import type { ValidationResult } from './validationResult';

function readDialogueState(state: ConversationCoreState): DialogueState {
  const raw = state.dialogueState;
  if (raw && typeof raw === 'object') {
    return raw as DialogueState;
  }
  return createInitialDialogueState();
}

export type ArchitecturePipelineResult = {
  semantic: SemanticInterpretation;
  contributions: TurnContribution[];
  dialogueDecision: DialogueDecision;
  dialogueStatePrior: DialogueState;
  dialogueStateNext: DialogueState;
  planner: PlannerResult;
  validation: ValidationResult;
  committed: CommitCanonicalOperationsResult;
  previewAct: PreviewConsultantAct;
};

export function runArchitecturePipeline(input: {
  message: string;
  currentState: ConversationCoreState;
  semantic?: SemanticInterpretation;
  now?: Date;
}): ArchitecturePipelineResult {
  const semantic =
    input.semantic ??
    interpretDiagnosticSemantic({
      message: input.message,
      currentState: input.currentState,
      now: input.now,
    });

  const dialogueStatePrior = readDialogueState(input.currentState);
  const contributions = buildTurnContributions(semantic);

  const dialogueDecision = reasonDialogue({
    dialogueState: dialogueStatePrior,
    contributions,
    semantic,
    hasBlockingClarification: input.currentState.openClarification?.blocking === true,
  });

  const planner = planCanonicalOperations({
    semantic,
    currentState: input.currentState,
    dialogueDecision,
    dialogueState: dialogueStatePrior,
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
    dialogueDecision,
    dialogueStatePrior,
  });

  const dialogueStateNext = updateDialogueStateAfterAct({
    prior: dialogueStatePrior,
    decision: dialogueDecision,
    act: previewAct,
    turnCount: input.currentState.turnCount + 1,
  });

  // Persist dialogue ownership on committed preview state (opaque to core).
  committed.state = {
    ...committed.state,
    dialogueState: dialogueStateNext,
  };

  return {
    semantic,
    contributions,
    dialogueDecision,
    dialogueStatePrior,
    dialogueStateNext,
    planner,
    validation,
    committed,
    previewAct,
  };
}
