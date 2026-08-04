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
  → buildInterpretationContext (message + full travel state + anchors + history + active requirement)
  → interpretTravelUtterance
      1) AI structured object with consultant prompt (Gateway /api/conversation/interpret)
      2) Offline semantic (contextual temporal anchors + TLI + active requirement)
      3) Regex fallback
  → validateAndMap / canonicalizePlaces
  → processConversationTurn({ stateUpdate, skipExtraction: true })
  → deterministic reply / follow-up
```

## Contextual understanding

The AI layer receives a complete context package (`TravelInterpretationContext`):
- current user message
- active missing requirement + meaning
- full travel-state snapshot
- temporal anchors (departure/return/primary anchor role)
- recent history, last assistant question, prior user message
- today ISO

Relative language (weekday-of-week, day after, that weekend, N nights later, same time, earlier flight, change to Friday, keep everything else) is resolved against those anchors into ISO dates / preferences. Deterministic code only validates and merges.

## Model / provider

- Server: Vercel AI Gateway via `generateText` + `Output.object` (`openai/gpt-5.4`)
- Endpoint: `POST /api/conversation/interpret`
- Auth: `AI_GATEWAY_API_KEY` or Vercel OIDC on deployment
- When AI is unavailable, offline contextual temporal semantics + TLI place resolution run (not legacy cue-extractor growth)

## Non-goals

- Production deploy / merge
- More Phase-21 phrase patches on destination/origin extractors
- AI writing canonical state without validation
