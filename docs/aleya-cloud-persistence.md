# Aleya cloud persistence — apply & verify

## Target (only)

| Item | Value |
|------|--------|
| Organisation | `tasqkbrzxjralyelioyv` (Aleya) |
| Project | aleya travel assistant |
| Ref | `jtktojbvbmiewpntpvhe` |
| URL | `https://jtktojbvbmiewpntpvhe.supabase.co` |

**Forbidden:** `farnjmgwcayvkzuaoifk`, ABoss, AI Invoicing, Aleya Logo Creator, any other project.

## Migrations (review order)

1. `supabase/migrations/20260718120000_travel_buddy_foundation.sql` — tables, RLS, helpers, profile trigger  
2. `supabase/migrations/20260718120100_travel_buddy_storage.sql` — `travel-documents` bucket + storage policies  
3. `supabase/migrations/20260719120000_travel_buddy_security_hardening.sql` — revoke anon execute, indexes, initplan policies  
4. `supabase/migrations/20260719120100_travel_buddy_launch_grants.sql` — grants to `authenticated` / `service_role`  
5. `supabase/migrations/20260719120200_travel_buddy_trips_returning_select.sql` — trips SELECT policy so INSERT…RETURNING works for owners

## Apply

Supabase MCP must be authenticated to org `tasqkbrzxjralyelioyv`, **or** use a PAT:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...   # account with access to Aleya org
bash scripts/apply-aleya-migrations.sh
```

The script refuses to run unless Management API reports:

- `id/ref == jtktojbvbmiewpntpvhe`
- `organization_id == tasqkbrzxjralyelioyv`
- name contains `aleya travel assistant`

## Verify

```bash
export VITE_SUPABASE_URL=https://jtktojbvbmiewpntpvhe.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=...
export SUPABASE_ACCESS_TOKEN=...   # optional SQL RLS/grants checks
bash scripts/verify-aleya-cloud.sh
```

Then complete the production browser flow: sign up/in → create trip → edit → reload → sign out → sign in → confirm data → second account isolation.

## Advisors

With MCP access to the project:

- `get_advisors` security
- `get_advisors` performance

## Types

This repository does not currently vendor generated Database types (`TravelBuddyClient` is loosely typed). After schema apply, optional:

```bash
npx supabase gen types typescript --project-id jtktojbvbmiewpntpvhe > src/lib/supabase/database.types.ts
```

only when a token with project access is available.
