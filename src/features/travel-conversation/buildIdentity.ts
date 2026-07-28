/**
 * Temporary preview build identity — rendered from the deployed bundle.
 * Values resolve from this module instance (import.meta / env), not hand-written.
 * Remove after PR #29 personal verification.
 */

import { resolveLiveBuildFingerprint } from './turnRuntimeEvidence';

export type AleyaBuildIdentity = {
  environment: string;
  gitSha: string;
  engine: string;
  chunk: string;
  entryPoint: 'runConversationTurn';
  consultantModulePresent: false;
};

export function getAleyaBuildIdentity(): AleyaBuildIdentity {
  const live = resolveLiveBuildFingerprint();
  return {
    environment: 'PR #29 Preview',
    gitSha: live.gitSha,
    engine: live.engineEntry,
    chunk: live.chunk,
    entryPoint: live.engineEntry,
    consultantModulePresent: false,
  };
}

/** Install console-inspectable identity on the travel-conversation chunk load. */
export function installAleyaBuildIdentity(): AleyaBuildIdentity {
  const identity = getAleyaBuildIdentity();
  if (typeof window !== 'undefined') {
    const w = window as Window & {
      __ALEYA_BUILD_IDENTITY__?: AleyaBuildIdentity;
      __ALEYA_ENGINE_ENTRY__?: string;
    };
    w.__ALEYA_BUILD_IDENTITY__ = identity;
    w.__ALEYA_ENGINE_ENTRY__ = 'runConversationTurn';
  }
  return identity;
}
