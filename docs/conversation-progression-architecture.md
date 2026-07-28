# Conversation progression architecture

## Single production path

```text
UI (AiPlanningPanel / ConciergePlanPanel)
  → sendTravelMessage / processTravelTurn
    → runConversationTurn
      → domain tools (normalize, extract, assign, merge, search providers)
```

No consultant adapter. No clarification planner. No secondary dialogue path.

## Turn stages (mandatory order)

1. Assemble complete conversational context
2. Determine user objective
3. Detect every goal in the message
4. Apply validated trip changes (domain extract/assign/merge + service patches)
5. Calculate known trip facts
6. Rank missing requirements → `nextRequiredField`
7. Create and validate ordered action plan (search/refine)
8. Execute every authorised action
9. Observe state changes and provider results
10. Decide next conversational step from completeness + observations
11. Generate one natural final response

Actions always complete before the reply is generated.

## Progression

`calculateTripCompleteness(canonicalState)` ranks:

1. destination  
2. origin  
3. exact departureDate  
4. tripType  
5. services (only when 1–4 done and services empty)

The reply asks for `nextRequiredField.question`. Generic clarifications are not part of the architecture.

## Contracts

Defined only in `conversation/contracts.ts` (`ConversationTurnResult`, `TripCompleteness`, `TurnGoal`, `PlannedAction`, `ConversationalStep`, `TurnTrace`).

## Domain tools retained

normalize, candidates/*, assign, merge, lexicon, store, project, search-projection, provider session helpers.

## Deleted orchestration

consultant/*, clarify.ts / evaluateClarification, ConversationPhase, AssistantOffer, lastOffer, pendingClarification, Clarification result contracts, consultant decision/trace/observation shapes.
