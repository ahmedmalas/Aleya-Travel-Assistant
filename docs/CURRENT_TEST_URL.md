# Current authoritative test URL (PR #29)

> **Status:** ACTIVE tip for personal verification  
> **Supersedes:** all earlier PR #29 immutable pins listed below

## Active build identity

| Field | Value |
|---|---|
| Immutable URL | https://travel-buddy-assistant-lmttqef7g-ahmedmalas-projects.vercel.app/ |
| Deployment ID | `dpl_BLKENwnWiLBAmDDoRwBhQ5UBj1Ps` |
| Feature Git SHA | `972c310` |
| Dist Git SHA | `40a9212` |
| Loaded chunk | `travel-conversation-SFityODo.js` |
| PR | [#29](https://github.com/ahmedmalas/Aleya-Travel-Assistant/pull/29) (Draft) |
| Timestamp (UTC) | 2026-07-28T11:19:39Z |

Before trusting any transcript, confirm the page shows matching **deploymentId / buildGitSha / loadedTravelChunk**.

Expected on-page identity:
```text
buildGitSha: 972c310
loadedTravelChunk: travel-conversation-SFityODo.js
```

## Superseded — do not use for tip verification

| Immutable host | Deployment | Chunk | SHA | Why superseded |
|---|---|---|---|---|
| `…40wg4wfhx…` | `dpl_EBo8RchGLXLZfjXNwF8dJgLQsuNN` | `travel-conversation-B6zQeu8l.js` | `18511d7` / `2f6f5bf` | Turn-evidence preview; no contextual reference layer |
| `…q3fvjxed4…` | `dpl_F9DKVBfhyoVANg4MhcP5CmtB2szi` | `travel-conversation-C_wkFoyi.js` | `cf59dc9` / `ca5f678` | Search-launch workspace; contextual references still failed |
| `…` tip before force-add | `dpl` from `aebba7f` | broken index without `SFityODo` assets | `aebba7f` | Incomplete dist push (gitignore); superseded by `40a9212` |

Branch alias `…git-cursor-5147e3…` moves on every tip push — never treat it as a permanent pin.

## Session identity rule

Visible progression wording proves **code path**, not which immutable host your tab loaded. Always read the on-page runtime identity panel.
