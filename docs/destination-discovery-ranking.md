# Destination discovery — catalogue and ranking

## Source

`src/features/travel-conversation/destination-discovery/catalogue.ts`

Curated destination metadata (not LI). Each entry has:

- `placeName` (LI resolve target on selection)
- region, characters, climate, vibe, budget band
- approximate flight hours from SYD / MEL / BNE
- activities, family flag, tags

## Hard filters

- rejected ids / exclusions (e.g. Bali)
- region bias (australia / pacific / asia / international)
- max travel hours from known origin airport
- family-only when traveller group is family
- city-break exclusive character filter
- snow/cool filter when snow requested

## Soft scoring

Additive points for character/climate matches, vibe alignment, flight-time fit, budget fit, activities, couple/family, short-trip suitability.

## Ranking

Sort by score desc, name asc. Top 3 returned with:

- `matchStrength`: strong / good / compromise (relative to top score)
- `reasons` / `tradeoffs` for explanation text

## Coverage gaps (proven limitations)

- Catalogue is AU/Pacific/Asia focused; Europe/Americas coverage is thin.
- Flight hours are approximate planning aids, not live schedules.
- No live fare/visa/weather claims.
- Destinations absent from both catalogue and LI cannot be selected cleanly.
- Ranking is deterministic heuristics — not ML personalisation.
