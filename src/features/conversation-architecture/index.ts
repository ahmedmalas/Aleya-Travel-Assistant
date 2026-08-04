/**
 * conversation-architecture — five-layer pipeline schemas and traces.
 *
 * Phase 1: schemas + diagnostic traces only.
 * Behaviour switch is OFF. Production Turn Governor remains authoritative.
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
