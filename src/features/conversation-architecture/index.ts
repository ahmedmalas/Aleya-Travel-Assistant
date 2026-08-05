/**
 * conversation-architecture — five-layer pipeline schemas and traces.
 *
 * Phase 1–4: schemas, planner, validator, committer, dual-run (diagnostic).
 * Phase 5: activation gates + reversible preview behaviour switch.
 * Production stays legacy unless VITE_ARCHITECTURE_GOVERNOR_SWITCH=true
 * and per-turn gates pass.
 */

export {
  clarificationDomainSchema,
  clarificationIssueTypeSchema,
  clarificationStatusSchema,
  referencedEntitySchema,
  clarificationSchema,
  emptyReferencedEntity,
  clarificationFromOpenClarification,
  type ClarificationDomain,
  type ClarificationIssueType,
  type ClarificationStatus,
  type ReferencedEntity,
  type Clarification,
} from './clarification';

export {
  semanticIntentSchema,
  semanticDeltaKindSchema,
  conversationalControlSchema,
  clarificationStanceSchema,
  semanticDeltaSchema,
  semanticInterpretationSchema,
  emptySemanticInterpretationResult,
  type SemanticIntent,
  type SemanticDeltaKind,
  type ConversationalControl,
  type ClarificationStance,
  type SemanticDelta,
  type SemanticInterpretation,
} from './semanticInterpretation';

export {
  canonicalOperationKindSchema,
  resolvedEntityRoleSchema,
  proposedOperationSchema,
  plannerResultSchema,
  emptyPlannerResult,
  type CanonicalOperationKind,
  type ResolvedEntityRole,
  type ProposedOperation,
  type PlannerResult,
} from './canonicalOperations';

export {
  clarificationActionSchema,
  rejectedOperationSchema,
  validationResultSchema,
  emptyValidationResult,
  type ClarificationAction,
  type RejectedOperation,
  type ValidationResult,
} from './validationResult';

export {
  architectureStageSchema,
  architectureTurnTraceSchema,
  buildArchitectureTurnTrace,
  type ArchitectureStage,
  type ArchitectureTurnTrace,
  type BuildArchitectureTurnTraceInput,
} from './architectureTrace';

export {
  planCanonicalOperations,
  resolvePlaceReferences,
  type PlanCanonicalOperationsInput,
} from './planCanonicalOperations';

export {
  validateCanonicalOperations,
  type ValidateCanonicalOperationsInput,
} from './validateCanonicalOperations';

export {
  commitCanonicalOperations,
  type CommitCanonicalOperationsInput,
  type CommitCanonicalOperationsResult,
} from './commitCanonicalOperations';

export { interpretDiagnosticSemantic } from './interpretDiagnosticSemantic';

export {
  choosePreviewConsultantAct,
  type PreviewConsultantAct,
} from './choosePreviewConsultantAct';

export {
  runDualPathComparison,
  runDualPathComparisonBundle,
  classifyDivergence,
  divergenceCategorySchema,
  dualRunComparisonSchema,
  type DivergenceCategory,
  type DualRunComparison,
  type RunDualPathComparisonInput,
  type DualPathComparisonBundle,
} from './dualRunComparison';

export {
  runArchitecturePipeline,
  type ArchitecturePipelineResult,
} from './runArchitecturePipeline';

export {
  evaluateActivationGates,
  ACTIVATION_GATE_IDS,
  type ActivationGateId,
  type ActivationGateResult,
  type ActivationGateReport,
} from './activationGates';

export {
  isArchitectureBehaviourSwitchActive,
  ARCHITECTURE_GOVERNOR_SWITCH_ENV,
} from './behaviourSwitch';

export {
  architectureStateUpdateFromCommit,
  consultantActFromPreview,
  type ArchitectureTurnApplication,
} from './applyArchitectureTurn';

export {
  PHASE5_DIVERGENCE_READINESS,
  assertDivergenceReadiness,
  type DivergenceReadinessVerdict,
} from './divergenceReadiness';
