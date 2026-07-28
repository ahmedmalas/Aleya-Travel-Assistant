# Destination discovery — planner actions

Executed inside `runConversationTurn` via `planDiscoveryActions` → `executeActions` → `decideNextStep`.

| Action | When | Effect |
| --- | --- | --- |
| `collect_discovery_criteria` | Discovery turn with criteria delta | Criteria already merged in apply; execute records observation |
| `ask_discovery_question` | Criteria insufficient for recommend | Sets `pendingQuestionId`; step/response ask highest-value missing question |
| `recommend_destinations` | `shouldRecommend(criteria)` | Ranks catalogue; writes `recommendations` |
| `refine_destination_recommendations` | Criteria changed with existing shortlist / reject-all | Re-ranks with exclusions + rejected ids |
| `resolve_selected_destination` | User selects a shortlisted (or named) place | LI `resolveSync` → canonical `destination` / `destinationPlace` |
| `transition_to_booking` | After resolve | `discovery.mode = completed`; booking completeness resumes |

## Completeness interaction

While `discovery.mode === 'active'`, missing destination is **not** pushed into `TripCompleteness.missing`. Booking fields (origin/date/…) may still appear in completeness for later handoff, but `decideNextStep` prioritises discovery steps.

## Response steps

- `ask_discovery_question`
- `recommend_destinations`

Neither emits `Where would you like to travel?` for active discovery.
