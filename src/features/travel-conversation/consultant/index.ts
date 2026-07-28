export { runConsultantTurn, resetConsultantRuntime, isSearchActive } from './turn';
export { assembleConsultantContext } from './context';
export { reasonConsultantTurn } from './reason';
export { validateDecision } from './validate';
export { executeConsultantDecision } from './execute';
export { realiseConsultantReply, assertHumanReply } from './respond';
export {
  getConsultantTraces,
  clearConsultantTraces,
  getSearchSession,
  getTranscript,
  appendTurn,
} from './memory';

export type {
  ConsultantTurnDecision,
  ConsultantTurnResult,
  ConsultantTrace,
  ConsultantGoal,
  ConsultantContext,
  ActionObservation,
} from './types';

import {
  getConsultantTraces,
  getSearchSession,
  getTranscript,
  isSearchActive,
} from './memory';

declare global {
  interface Window {
    __aleyaConsultant?: {
      getTranscript: typeof getTranscript;
      getConsultantTraces: typeof getConsultantTraces;
      getSearchSession: typeof getSearchSession;
      isSearchActive: typeof isSearchActive;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__aleyaConsultant = {
    getTranscript,
    getConsultantTraces,
    getSearchSession,
    isSearchActive,
  };
}
