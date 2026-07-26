# Provider Adapter Specification

Travel Buddy keeps product inventory behind the **Travel Provider Integration Layer** (`src/providers/`). The UI calls `src/providers/gateway.ts` only.

The deal-engine adapter path (`src/deal-engine/adapters/`) remains available for ranking/handoff demos and follows the same mock-first rules.

## Contract

Each adapter implements:

| Capability | Description |
|---|---|
| Search | Category-scoped query with abort signal |
| Offer normalisation | Map provider payloads → `UniversalOffer` |
| Availability status | `available` / `limited` / `unavailable` / `unknown` |
| Price freshness | `live` / `cached` / `estimated` / `simulated` |
| Deep link | Partner redirect URL |
| Affiliate metadata | Partner/campaign IDs, disclosure, sponsored flag |
| Provider health | Healthy / degraded / down / rate_limited |
| Rate-limit handling | Surfaced on search result; orchestrator continues others |
| Timeout / retry | Per-adapter `timeoutMs` + `maxRetries`; orchestrator bounds concurrency |
| Legal attribution | Display name, data source, terms/privacy placeholders |

## Inventory categories

Flights, accommodation, car hire, airport transfers, trains, buses, ferries, activities, travel insurance, eSIMs, airport parking.

## Live connection rules

- Mock/demo adapters ship first (`isLive: false`).
- Live adapters require credentials **and** explicit approval before `registerLiveAdapter`.
- Never scrape providers or bypass access restrictions.
- Never place private API credentials in the frontend.
- Cache only within provider rules; retain price timestamps.
- Clearly label live vs cached vs estimated vs simulated prices.

## Orchestration

`searchProvidersConcurrently` fans out to category adapters with bounded timeouts, deduplicates offers, and reports partial/timeout/rate-limit providers so the UI never pretends a result set is globally complete.
