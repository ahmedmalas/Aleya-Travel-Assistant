# Current authoritative PR #29 test URL

**Use this URL only.**

```text
https://travel-buddy-assistant-1kemub2h8-ahmedmalas-projects.vercel.app/
```

## Expected identity (must match before testing)

| Field | Value |
| --- | --- |
| `buildGitSha` | `ee924c3` |
| `loadedTravelChunk` | `travel-conversation-CuR8-RFq.js` |
| `deploymentId` | `dpl_GKbx8XW6oPAQzi3eCyZLcBujxrSc` |

Confirm in DevTools → Console:

```js
window.__ALEYA_BUILD__
```

If any field differs, **stop**. You are on the wrong deployment.

## Access rules

- Do **not** open any other immutable `*.vercel.app` hostname for verification.
- Do **not** use the Vercel PR “Preview” / branch-alias button as the verification pin. Prefer pasting the URL above.
- Historical agent artifacts and superseded evidence files are not test instructions.

## Tip-side quarantine gate (limitation)

Builds that contain `SupersededPreviewGate` can show a full-page DO-NOT-TEST block on non-pin preview hosts **that load that tip bundle**.

That gate **cannot** change or warn on older immutable deployments that predate it. Those hosts keep serving their original JS until deleted in the Vercel dashboard.
