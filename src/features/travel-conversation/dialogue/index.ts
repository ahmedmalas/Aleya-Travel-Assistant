export { runDialogueTurn, getTranscript } from './orchestrate';
export { resetDialogueRuntime } from './runtime';
export { assembleContext } from './context';
export { analyzeGoals } from './goals';
export { decideDialogue } from './decide';
export { executeDecision } from './execute';
export { realiseResponse, assertHumanReply } from './nlg';
export { getDialogueTraces, clearDialogueTraces, pushDialogueTrace } from './traces';
export {
  getSearchMemory,
  isSearchActive,
  resetSearchMemory,
  endSearchSession,
} from './searchMemory';
export { clearTranscript, appendTurn } from './transcript';
export type {
  DialogueDecision,
  DialogueTurnResult,
  DialogueTrace,
  UserGoal,
  ConversationContext,
} from './types';

import { getTranscript } from './transcript';
import { getDialogueTraces } from './traces';
import { getSearchMemory, isSearchActive } from './searchMemory';

declare global {
  interface Window {
    __aleyaDialogue?: {
      getTranscript: typeof getTranscript;
      getDialogueTraces: typeof getDialogueTraces;
      getSearchMemory: typeof getSearchMemory;
      isSearchActive: typeof isSearchActive;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__aleyaDialogue = {
    getTranscript,
    getDialogueTraces,
    getSearchMemory,
    isSearchActive,
  };
}
