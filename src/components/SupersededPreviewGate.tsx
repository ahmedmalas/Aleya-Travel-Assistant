import type { ReactNode } from 'react';
import {
  AUTHORITATIVE_DEPLOYMENT_ID,
  AUTHORITATIVE_HOST,
  AUTHORITATIVE_TEST_URL,
  isSupersededPreviewHost,
} from '../features/travel-conversation/previewTipPin';

/**
 * Full-page block for known-obsolete immutable preview hosts when this tip
 * bundle is loaded there. Older immutable deploys that predate this component
 * cannot self-warn — delete them in the Vercel dashboard.
 */
export function SupersededPreviewGate({ children }: { children: ReactNode }) {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (!hostname || !isSupersededPreviewHost(hostname)) {
    return children;
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-rose-950 px-6 py-16 text-center text-rose-50"
      data-testid="superseded-preview-gate"
      role="alert"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-200">
        PR #29 preview quarantine
      </p>
      <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
        THIS IS A SUPERSEDED PR #29 BUILD.
        <br />
        DO NOT TEST THIS DEPLOYMENT.
      </h1>
      <p className="mt-6 max-w-2xl text-sm leading-6 text-rose-100/90">
        Hostname <code className="rounded bg-black/30 px-1.5 py-0.5">{hostname}</code> is an
        obsolete immutable preview. Close this tab. Open only the authoritative tip below.
      </p>
      <a
        href={AUTHORITATIVE_TEST_URL}
        className="mt-8 inline-flex max-w-full break-all rounded-xl bg-white px-5 py-3 text-left text-sm font-semibold text-rose-950 hover:bg-rose-100"
      >
        {AUTHORITATIVE_TEST_URL}
      </a>
      <p className="mt-4 font-mono text-[11px] text-rose-200/80">
        Expected host {AUTHORITATIVE_HOST}
        <br />
        Expected: buildGitSha ff28b5f · chunk DI1Mrvns · dpl_3TFsCybAFSJpkAGmh3eNV9hvMtWP
      </p>
    </div>
  );
}
