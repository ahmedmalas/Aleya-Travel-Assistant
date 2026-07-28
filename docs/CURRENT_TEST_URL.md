# Current authoritative PR #29 test URL

**Use this URL only.**

```text
https://travel-buddy-assistant-58jmbjjc2-ahmedmalas-projects.vercel.app/
```

## Expected identity (must match before testing)

| Field | Value |
| --- | --- |
| `buildGitSha` | `a3765e1` (feature tip; commit `4e6808f` ships the dist) |
| `loadedTravelChunk` | `travel-conversation-DY7YtCx3.js` |
| `deploymentId` | `dpl_7zqcjeDzaxjQSmQdZVA7fFvnwK1H` |

Confirm in DevTools → Console:

```js
window.__ALEYA_BUILD__
window.__ALEYA_BUILD_IDENTITY__
```

If any field differs, **stop**. You are on the wrong deployment.

## Access rules

- Do **not** open any other immutable `*.vercel.app` hostname for verification.
- Do **not** use the Vercel PR “Preview” / branch-alias button as the verification pin. Prefer pasting the URL above.
- Historical agent artifacts and superseded evidence files are not test instructions.

## Tip-side quarantine gate

Builds that contain `SupersededPreviewGate` block known superseded host markers and moving `-git-` branch aliases. Fresh immutable tips remain open for verification when the pin lags one deploy.
