/**
 * Classification entry — delegates to the intent router.
 * Kept as the Stage-2 import surface for the pipeline.
 */

export {
  classifyIntent as classifyMessage,
  isConfirmationMessage,
  isFinalConfirmationMessage,
  isSoftAffirmMessage,
  type IntentClassification as Classification,
} from './intentRouter';
