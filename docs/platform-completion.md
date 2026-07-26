# ALEYA Travel Assistant — Platform Completion Guide

**Branch:** `cursor/aleya-platform-complete-e69b`  
**Includes:** PR #21 (travel search UX) + PR #22 (provider integration layer) + end-to-end completion work  
**Supersedes for this phase:** incomplete draft slices that duplicated vault/provider work; keep PR #20 cloud persistence lineage where already merged into tips.

## Architecture summary

```
UI panels (TripPlatform)
  → useTripStore / vault / travel ops
  → Provider Gateway (src/providers/gateway.ts)
      → Provider interfaces
          → Mock adapters (Amadeus, Duffel, Booking.com, Expedia, Hotelbeds, Viator, placeholders)
          → Future live adapters (server-side secrets only)
  → Supabase (auth, RLS trips/documents, private storage)
```

Principles:

- UI never calls supplier APIs directly.
- Mock/live states are labelled in UI and provider meta.
- Private credentials are never `VITE_*`.
- Collaboration and documents enforce RLS / permission matrix.
- AI planning uses a secure mock abstraction until an approved AI provider is wired.

## Feature-completion matrix

| Area | Status | Notes |
|---|---|---|
| Origin/destination autocomplete | Complete | PR #21 |
| Date pickers (AU) | Complete | PR #21 |
| Flights / Hotels / Itineraries | Complete | Gateway + mock offers |
| Travel Services Hub | Complete | Planning workflows via gateway/mocks |
| Provider gateway + mocks | Complete | PR #22 |
| Traveller profiles (full fields) | Complete | Multi-traveller, loyalty, companions, metadata-only ID |
| Trip lifecycle | Complete | create/name/type/routes/dates/travellers/budget/style/draft/duplicate/archive/restore/delete/status/tags/cover/timeline |
| Trip templates | Complete | solo, couples, family, business, road, cruise, weekend, honeymoon, group, accessible, adventure |
| AI planning | Complete (mock) | Generate/revise/apply, versions, locks, labelled |
| Itinerary workspace | Complete | timeline, calendar, DnD, lock, ICS, print, conflicts |
| Budget / FX / deposits / refunds / splits | Complete | Manual FX; provider abstraction ready |
| Documents | Complete | Private storage + RLS lineage |
| Packing | Complete | Templates + progress; AI suggestions via AI panel |
| Notifications | Complete (in-app) | Delivery providers for email/push/SMS/calendar are placeholders |
| Calendar ICS / print | Complete | Google/Microsoft adapters are placeholders |
| Collaboration | Complete | Roles + invite/accept/revoke; RLS preserved |
| Concierge workspace | Complete | Goals/constraints/checklist/approvals + convert-to-itinerary |
| Destinations | Complete | Curated/mock profiles; live APIs future |
| Booking organiser | Complete | Manual + import placeholders |
| Emergency centre | Complete | Workflows + offline essentials lineage |
| Offline / sync | Complete | Indicator, queue, retry |
| Global search | Complete | Trips, itinerary, bookings, docs, packing, travellers, destinations, notes, services |
| Dashboard / command centre | Complete | Existing + lifecycle fields |
| Settings / export / deletion | Complete | Local clear + sign-out; hard auth delete needs server function |
| Admin area | Complete | Role-gated (`app_role` / allowlist); traveller forbidden |
| Support / FAQ / tickets | Complete | Local ticket store |
| Security / RLS / storage | Complete | Existing migrations + no public secrets |
| Docs | Complete | This package |

## Supplier / provider readiness matrix

| Provider | Service | Mode now | Activation later |
|---|---|---|---|
| Amadeus | Flights / hotels | Mock adapter | Server secrets + live adapter behind gateway |
| Duffel | Flights | Mock adapter | Same |
| Booking.com / Expedia / Hotelbeds | Hotels | Mock adapters | Same |
| Viator | Activities | Mock adapter | Same |
| Car hire / transfers / cruises / rail / insurance | Planning | Mock / placeholder | Add adapters; keep gateway fan-out |
| Maps / weather / events | Placeholders | Curated/mock | Add provider interfaces; no hardcoded keys |
| Email / push / SMS | Placeholders | In-app only | Wire `deliveryProviders.ts` |
| Google / Microsoft calendar | Placeholders | ICS download | OAuth adapters in `icsExport.ts` |
| AI models | Mock abstraction | `aiPlanning.ts` | Replace generator; keep labelling |

### Exact live-provider activation steps (later)

1. Obtain commercial approval and credentials for the supplier.
2. Store private keys in server/edge env only (`AMADEUS_*`, `DUFFEL_*`, etc.) — never `VITE_*`.
3. Implement/enable the live adapter under `src/providers/adapters/`.
4. Register it in `src/providers/registry.ts` when `status=live` and secrets present.
5. Keep UI calling only `src/providers/gateway.ts`.
6. Run provider contract tests + RLS + Playwright smoke.
7. Flip supplier config status from `mock` → `live` in env-driven config.
8. Verify UI badges show live vs mock correctly and never claim mock inventory as live.

## Security review results

- Auth: Supabase auth shell + demo-local mode; no demo bypass of RLS on cloud.
- Authorisation: collaboration permission matrix + admin role assertions.
- RLS / storage: existing migrations (`20260718120000`–`20260719120200`); documents via private paths + signed URLs.
- Secrets: provider secrets loader documents private keys server-side; public env limited.
- Input validation: trip/traveller/expense sanitizers; support ticket trimming.
- Destructive actions: vault delete last-trip guard; account deletion confirmation phrase + blockers.
- Mock safety: disclaimers on AI, concierge, providers, ICS print.
- Error sanitisation: cloud messages surface provider errors without dumping secrets.

## Remaining external blockers only

1. Amadeus / Duffel / Viator / hotel / car / cruise / transfer commercial approvals + credentials.
2. Live AI provider credentials (optional; mock AI works now).
3. Email / push / SMS vendor accounts.
4. Google / Microsoft calendar OAuth apps.
5. Privileged server function for hard auth-user deletion.
6. Maps / weather / events API keys.
7. Any Vercel preview rate limits during deploy.

## Migrations (existing — do not duplicate)

- `supabase/migrations/20260718120000_travel_buddy_foundation.sql`
- `supabase/migrations/20260718120100_travel_buddy_storage.sql`
- `supabase/migrations/20260719120000_travel_buddy_security_hardening.sql`
- `supabase/migrations/20260719120100_travel_buddy_launch_grants.sql`
- `supabase/migrations/20260719120200_travel_buddy_trips_returning_select.sql`
