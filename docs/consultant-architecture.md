# Aleya consultant agent architecture

## Principle

Canonical trip state and search tools help Aleya. They do not speak for her.

The sole production conversation path is the **consultant agent loop**.

## Loop

```text
User message
    ↓
Assemble full conversational context
    ↓
Understand every user goal in the message
    ↓
Create ordered action plan (ConsultantTurnDecision)
    ↓
Validate each action
    ↓
Execute all actions
    ↓
Observe results
    ↓
Generate one natural human response
```

## Modules

| Path | Role |
|---|---|
| `consultant/context.ts` | Full context: message, turns, trip, offers, search session |
| `consultant/reason.ts` | Multi-goal structured decision (not reply templates) |
| `consultant/validate.ts` | Safety checks before mutation / tools |
| `consultant/execute.ts` | Validated extract/merge, services, search session |
| `consultant/respond.ts` | Natural reply from verified observations only |
| `consultant/session.ts` | Active search session + planning placeholders |
| `consultant/memory.ts` | Transcript + traces |
| `consultant/turn.ts` | Sole entry used by `pipeline.ts` |

## Non-negotiable rules

- Never invent accommodation, car hire, return date, travellers, budget, or preferences.
- Multiple goals in one message are all executed (e.g. add hotel + car hire + start search).
- After the user accepts a search offer, do not ask permission again.
- Never repeat the previous Aleya reply after the user acts.
- Spoken replies must not sound like the Saved Requirements panel.

## Deleted

The previous `dialogue/` orchestration (goals/decide/nlg/orchestrate and related) is removed. No dual path, no wrappers, no feature flag.

## Preserved tools

`normalize`, `candidates/*`, `assign`, `merge`, `clarify`, `project` (panel only), `search-projection/*`, `lexicon`, `store`.
