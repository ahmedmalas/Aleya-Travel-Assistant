/**
 * Temporary preview build identity — rendered from the deployed bundle.
 * Remove after PR #29 personal verification.
 */

export type AleyaBuildIdentity = {
  environment: string;
  gitSha: string;
  engine: string;
  chunk: string;
  entryPoint: 'runConversationTurn';
  consultantModulePresent: false;
  loadedConsultantChunkP8G9cQpq: false;
};

function resolveChunkName(): string {
  try {
    const url = String(import.meta.url);
    const match = url.match(/travel-conversation-[A-Za-z0-9_-]+\.js/);
    if (match?.[0]) return match[0];
    const file = url.split('/').pop();
    if (file?.includes('travel-conversation')) return file.split('?')[0] ?? file;
  } catch {
    // ignore
  }
  return 'travel-conversation-(unresolved)';
}

export function getAleyaBuildIdentity(): AleyaBuildIdentity {
  const gitSha =
    (import.meta.env.VITE_GIT_SHA as string | undefined)?.trim() ||
    (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined)?.slice(0, 7) ||
    'local-dev';

  return {
    environment: 'PR #29 Preview',
    gitSha,
    engine: 'runConversationTurn',
    chunk: resolveChunkName(),
    entryPoint: 'runConversationTurn',
    consultantModulePresent: false,
    loadedConsultantChunkP8G9cQpq: false,
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
