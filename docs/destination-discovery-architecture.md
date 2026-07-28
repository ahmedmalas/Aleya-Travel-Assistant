# Destination discovery — architecture (PR #29)

## Spine

Discovery runs inside `runConversationTurn` only:

```text
normalize → objective → goals → apply (trip + discovery criteria)
→ completeness → plan → execute (recommend / resolve / transition)
→ decideNextStep → generateResponse → persist (schema v7)
```

No separate consultant path, endpoint, or UI-only flow.

## Modes on `ConversationState.discovery`

| Mode | Meaning |
| --- | --- |
| `inactive` / absent | Normal named-destination booking |
| `active` | Collecting criteria and/or recommending |
| `selected` | User chose a candidate; destination set via LI |
| `completed` | Handed off to booking completeness |

While `mode === 'active'`, missing `destination` does **not** drive `ask_missing_field(destination)`.

## Planner actions

- `collect_discovery_criteria` — criteria merged this turn
- `ask_discovery_question` — highest-value missing question
- `recommend_destinations` — filter/score/rank catalogue
- `refine_destination_recommendations` — re-rank after criterion change
- `resolve_selected_destination` — LI resolve + set canonical destination
- `transition_to_booking` — mark discovery completed; booking questions resume

## Candidate source

`destination-discovery/catalogue.ts` — metadata for filtering/scoring (characters, climate, vibe, approx flight hours from SYD/MEL/BNE, budget band, activities, region). Place **identity** still goes through LI `resolveSync` on selection.

## LI boundary

LI: named resolve, airports, hierarchy, ambiguity, replace, nearby.  
Discovery: criteria, questions, candidates, ranking, explanations.
