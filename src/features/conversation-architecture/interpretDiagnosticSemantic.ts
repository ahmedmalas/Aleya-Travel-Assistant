/**
 * Temporary compatibility alias.
 *
 * Semantic Interpretation ownership lives in conversation-interpretation
 * (`interpretSemanticMeaning`). This re-export preserves existing import paths
 * during Engine Consolidation Phase 1.
 */

export { interpretSemanticMeaning as interpretDiagnosticSemantic } from '../conversation-interpretation/interpretSemanticMeaning';
