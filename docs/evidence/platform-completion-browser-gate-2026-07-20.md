# Platform completion browser gate — 2026-07-20

**Branch:** `cursor/aleya-platform-complete-e69b`  
**SHA tip:** `73d3566a2bbe68f8f42ef5649035064ea71ac11b` (gates verified at `1254ad7817864bc65fc8e6002ab22db091c81204`; tip adds this evidence doc only)  
**PR:** #23 (draft)  
**Preview tip:** https://travel-buddy-assistant-g8v5l7hjg-ahmedmalas-projects.vercel.app (`dpl_3Bo12YCtZyuhKJcowemSRqdad3Da`, READY)  
**Branch alias:** https://travel-buddy-assistant-ai-git-cursor-fb6ce1-ahmedmalas-projects.vercel.app

## Automated gates

| Gate | Result |
|---|---|
| typecheck | pass |
| unit/integration tests | 202 passed / 57 files |
| production build | pass |
| Playwright smoke (`npm run test:e2e`) | 5 passed |
| dependency audit (`npm audit --omit=dev`) | 0 vulnerabilities |
| migrations | existing set only (no new duplicates) |

## Browser evidence (local preview `http://127.0.0.1:4173`)

Screenshots:

- `/opt/cursor/artifacts/screenshots/desktop-platform.png`
- `/opt/cursor/artifacts/screenshots/desktop-flights.png` — Planning and recommendation tool badge visible
- `/opt/cursor/artifacts/screenshots/desktop-hotels.png` — Planning badge visible
- `/opt/cursor/artifacts/screenshots/desktop-ai-planning.png` — mock AI labelling visible
- `/opt/cursor/artifacts/screenshots/desktop-admin-forbidden.png` — traveller role forbidden
- `/opt/cursor/artifacts/screenshots/desktop-support.png`
- `/opt/cursor/artifacts/screenshots/desktop-vault.png`
- `/opt/cursor/artifacts/screenshots/desktop-collaboration.png`
- `/opt/cursor/artifacts/screenshots/mobile-platform.png`
- `/opt/cursor/artifacts/screenshots/mobile-travellers.png`
- `/opt/cursor/artifacts/screenshots/mobile-offline.png`

Verified:

1. Mock/planning labels unmistakable on Flights and Hotels.
2. Admin panel forbidden for traveller role (role assertion, not UI-only hide).
3. AI planning mock disclaimer present.
4. Vault loads without chunk errors on rebuilt preview.
5. Mobile section navigation reaches Travellers.
6. Offline event surfaces degraded/offline UI path.

## Account A/B collaboration

Prior production isolation evidence remains valid for Supabase project `jtktojbvbmiewpntpvhe` (see `docs/evidence/aleya-app-production-browser-gate-2026-07-19.md`). Full live Account A→B share/revoke re-run depends on preview deployment + signed-in cloud session; local preview used demo/local auth shell for UI gates above.

Known test accounts (production):

- A: `prodgate1784458532@guerrillamailblock.com`
- B: `prodgateb1784462130@guerrillamailblock.com`

## RLS / storage isolation

No migration changes in this PR. Existing RLS + private storage policies from:

- `20260718120000_travel_buddy_foundation.sql`
- `20260718120100_travel_buddy_storage.sql`
- `20260719120000_travel_buddy_security_hardening.sql`
- `20260719120100_travel_buddy_launch_grants.sql`
- `20260719120200_travel_buddy_trips_returning_select.sql`

Cross-account isolation previously proven via REST owner_id overlap = 0.

## Security review (this phase)

- No supplier secrets in `VITE_*`
- Provider gateway remains the only UI inventory surface
- Admin capabilities gated by `resolveAppRole` / `assertAdminCapability`
- Account deletion clears local keys + signs out; hard auth delete remains server-side blocker
- AI/mock outputs labelled

## External blockers only

Live Amadeus/Duffel/Viator/hotel/car/cruise/transfer credentials; live AI; email/push/SMS; Google/Microsoft OAuth; hard auth-user delete function; maps/weather/events keys; Vercel preview rate limits if any.
