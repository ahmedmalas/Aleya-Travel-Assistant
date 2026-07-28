# Aleya dialogue architecture — human travel consultant

## Principle

Canonical travel state and search tools exist to **help** Aleya. They do not speak for her.

The sole production conversation path is the dialogue orchestration layer.

## Pipeline

```text
User message
    ↓
Input normalisation (spelling / surface form)
    ↓
Conversation context assembly
    ↓
User goal understanding (multi-goal capable)
    ↓
DialogueDecision (structured, validated)
    ↓
Execute state / search actions via tools
    ↓
Natural language realisation from response plan
    ↓
Transcript + decision trace
```

## Modules

| Path | Role |
|---|---|
| `dialogue/context.ts` | Assemble message, recent turns, trip, search session, offers, aim |
| `dialogue/goals.ts` | Infer conversational goals from **full context** |
| `dialogue/decide.ts` | Produce `DialogueDecision` (facts + actions, no prose mutation) |
| `dialogue/execute.ts` | Run extract/assign/merge, search session start/refine/refresh |
| `dialogue/nlg.ts` | Realise natural consultant replies from verified response plans (compositional; no live LLM required) |
| `dialogue/searchMemory.ts` | Active search session + planning result placeholders |
| `dialogue/transcript.ts` | Recent conversational turns |
| `dialogue/orchestrate.ts` | Sole entry used by `pipeline.ts` |
| `dialogue/runtime.ts` | In-memory transcript / search session / traces |
| `dialogue/traces.ts` | Decision traces for tests / debugging |

## Preserved internal tools (not dialogue)

- `normalize.ts`, `candidates/*`, `assign.ts`, `merge.ts`, `clarify.ts`
- `project.ts` (Saved Requirements panel only)
- `search-projection/*` (canonical → provider handoff)
- `lexicon.ts`, `store.ts` (canonical persistence)

## Deleted dialogue layer

Removed from production (no wrappers, no dual engine):

- `compose.ts`
- `postRequirements.ts`
- `classify.ts`
- `debugTrace.ts` (compose-branch tracer)

## Search sessions

Created only when live search starts. Natural hotel/flight/car follow-ups refine the active session. Requirement changes refresh affected searches. A new trip ends the session automatically — no manual clear.

## Safety

NLG must not invent prices, availability, or completed bookings. Planning placeholders are labelled as such. Anti-robot gates reject legacy template phrases.
