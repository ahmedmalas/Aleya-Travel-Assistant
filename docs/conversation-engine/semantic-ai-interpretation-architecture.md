# Semantic AI conversation interpretation

Architecture replacement for regex-first destination/origin cue patches.

**Status:** IMPLEMENTED — PENDING AHMED'S PHYSICAL RUNTIME VERIFICATION.
Do not treat automated tests as acceptance.

## Ownership

| Layer | Owner |
| --- | --- |
| Semantic interpretation | `src/features/conversation-interpretation` |
| Place canonicalisation | `travel-location-intelligence` |
| State merge / progression / replies | `conversation-core` (deterministic) |
| Regex extractors | Fallback only inside interpretation |

## Turn path

```text
AiPlanningPanel
  → interpretTravelUtterance (AI → offline-semantic → regex fallback)
  → processConversationTurn({ stateUpdate, skipExtraction: true })
  → deterministic reply / follow-up
```

## Model / provider

- Server: Vercel AI Gateway via `generateText` + `Output.object` (`openai/gpt-5.4`)
- Endpoint: `POST /api/conversation/interpret`
- Auth: `AI_GATEWAY_API_KEY` or Vercel OIDC on deployment
- When AI is unavailable, offline semantic adapter uses active requirement + TLI place resolution (not legacy cue-extractor growth)

## Non-goals

- Production deploy / merge
- More Phase-21 phrase patches on destination/origin extractors
- AI writing canonical state without validation
