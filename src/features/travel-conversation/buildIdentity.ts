/**
 * Temporary preview build identity — rendered from the deployed bundle.
 * Remove after PR #29 personal verification.
 *
 * Pinned to the known-good progression ship (6882faf / BoezO4jf) so the
 * preview banner matches the investigation fingerprint. Do not rebuild the
 * travel-conversation chunk while this pin is active.
 */

export type AleyaBuildIdentity = {
  environment: string;
  gitSha: string;
  engine: string;
  chunk: string;
  entryPoint: 'runConversationTurn';
  consultantModulePresent: false;
};

/** Known-good PR #29 progression fingerprint — keep in sync with shipped dist. */
export const PR29_PREVIEW_BUILD_IDENTITY: AleyaBuildIdentity = {
  environment: 'PR #29 Preview',
  gitSha: '6882faf',
  engine: 'runConversationTurn',
  chunk: 'travel-conversation-BoezO4jf.js',
  entryPoint: 'runConversationTurn',
  consultantModulePresent: false,
};

export function getAleyaBuildIdentity(): AleyaBuildIdentity {
  return { ...PR29_PREVIEW_BUILD_IDENTITY };
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
