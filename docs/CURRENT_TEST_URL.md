# Current authoritative PR #29 test URL

**Use this URL only.**

```text
https://travel-buddy-assistant-9bxidvrun-ahmedmalas-projects.vercel.app/
```

## Expected identity (must match before testing)

| Field | Value |
| --- | --- |
| `buildGitSha` | `ff28b5f` (feature tip; commit `865495d` ships the dist) |
| `loadedTravelChunk` | `travel-conversation-DI1Mrvns.js` |
| `deploymentId` | `dpl_3TFsCybAFSJpkAGmh3eNV9hvMtWP` |
| Engine | `runConversationTurn` |
| Capability | Destination discovery on the conversation spine (schema v7) |

Confirm in DevTools → Console:

```js
window.__ALEYA_BUILD__
window.__ALEYA_BUILD_IDENTITY__
```

If any field differs, **stop**. You are on the wrong deployment.

## Access rules

- Do **not** open any other immutable `*.vercel.app` hostname for verification.
- Do **not** use the Vercel PR “Preview” / branch-alias button as the verification pin. Prefer pasting the URL above.
- Historical tip `58jmbjjc2` (location-intelligence only, no discovery) is superseded.

## Tip-side quarantine gate

Builds that contain `SupersededPreviewGate` block known superseded host markers and moving `-git-` branch aliases. Fresh immutable tips remain open for verification when the pin lags one deploy.
