# Current authoritative PR #29 test URL

**Use this URL only.** Do not open any other `*.vercel.app` hostname for conversation-progression verification.

```text
https://travel-buddy-assistant-1kemub2h8-ahmedmalas-projects.vercel.app/
```

## Expected identity (must match before testing)

| Field | Value |
| --- | --- |
| `buildGitSha` | `ee924c3` |
| `loadedTravelChunk` | `travel-conversation-CuR8-RFq.js` |
| `deploymentId` | `dpl_GKbx8XW6oPAQzi3eCyZLcBujxrSc` |
| Host marker | `1kemub2h8` |

Open DevTools → Console:

```js
window.__ALEYA_BUILD__
```

If any of those fields differ, **stop**. You are on the wrong deployment.

## Do not use the Vercel PR Preview button for this verification

The PR “Preview” link is a moving branch alias. It is **not** the pin. Close it if it opens. Paste only the immutable tip URL above.

## Do not test superseded immutable deployments

Earlier agent handoffs pinned an obsolete immutable hostname. That deployment is **superseded**. It still fails `all the above please` / `all please` and keeps `nextRequiredField: services` because it predates contextual reference resolution.

**Do not bookmark, reopen, or paste any older immutable host.** If a bookmarked or SSO-cached preview opens an obsolete host, discard it and paste the tip URL from this document only.

If a build that includes the superseded-preview gate loads on an obsolete host marker, the app shows a full-page block:

```text
THIS IS A SUPERSEDED PR #29 BUILD.
DO NOT TEST THIS DEPLOYMENT.
```

with a link to the tip URL above. Builds that predate that gate cannot self-warn — delete those deployments in the Vercel dashboard if they remain reachable (`dpl_EBo8RchGLXLZfjXNwF8dJgLQsuNN` and any other non-tip immutable).

## Stale artifact quarantine

Do **not** follow verification URLs from older agent artifacts or prior “verified test URL” notes. Those files have been rewritten to point only here. This document is the sole active handoff.
