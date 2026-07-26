# Aleya cloud persistence — CLI apply evidence (sanitized)

**Run:** `bc-2c47c236-68ea-4bd5-aabb-038241824e4a`  
**Branch:** `cursor/aleya-cloud-persistence-03b5`  
**UTC:** 2026-07-19  
**Method:** Supabase CLI + Management API (session `SUPABASE_ACCESS_TOKEN`); **Supabase MCP not used**  
**Target org:** `tasqkbrzxjralyelioyv`  
**Target project (only):** `jtktojbvbmiewpntpvhe`  

No access tokens, service-role keys, publishable keys, JWTs, passwords, or user emails are included below.  
No other Supabase project received migrations or schema changes.

## 1. Apply path

| Step | Result |
|------|--------|
| `npx supabase link --project-ref jtktojbvbmiewpntpvhe` | Linked (`linked: true` for target only) |
| `npx supabase db push` (foundation + storage) | Applied |
| `npx supabase db push` (hardening + grants) | Applied |
| `npx supabase db push` (trips RETURNING select fix) | Applied |

### Remote `supabase_migrations.schema_migrations`

| version | name |
|---------|------|
| `20260718120000` | `travel_buddy_foundation` |
| `20260718120100` | `travel_buddy_storage` |
| `20260719120000` | `travel_buddy_security_hardening` |
| `20260719120100` | `travel_buddy_launch_grants` |
| `20260719120200` | `travel_buddy_trips_returning_select` |

## 2. Schema / storage / RLS / grants

**Public tables present:** `document_objects`, `profiles`, `sync_revisions`, `trip_activity`, `trip_collaborators`, `trip_templates`, `trips`

**Storage bucket `travel-documents`:** `public=false`, `file_size_limit=10485760`  
**Storage policies:** `travel_documents_select|insert|update|delete`

**RLS enabled:** all seven public tables above (`relrowsecurity=true`)

**Function EXECUTE grants (authenticated + service_role only):**  
`is_trip_member`, `can_edit_trip`, `trip_role`, `storage_trip_id`  
(no `anon` / `public` grantees on those helpers)

## 3. PostgREST non-404

Anonymous/publishable probes against `/rest/v1/{table}`:

| table | HTTP (not 404) |
|-------|----------------|
| `profiles` | 200 |
| `trips` | 401 (relation exposed; RLS/JWT required) |
| `trip_templates` | 200 |
| `trip_collaborators` | 401 |
| `trip_activity` | 401 |
| `sync_revisions` | 401 |
| `document_objects` | 401 |

Authenticated Account A: `profiles` 200, `trips` 200.

## 4. Advisors (`npx supabase db advisors --linked`)

| Type | Count | Levels |
|------|-------|--------|
| security | 6 | WARN only (0 ERROR) |
| performance | 4 | WARN only (0 ERROR) |

Security WARN names: `anon_security_definer_function_executable` (`handle_new_user`), `authenticated_security_definer_function_executable` (helpers + `handle_new_user`), `auth_leaked_password_protection`  
Performance WARN name: `auth_rls_initplan` (remaining policies on `trip_templates` select/update/delete and `trips_delete_owner`)

## 5. Account A persistence + Account B isolation

Ephemeral admin-created users (deleted after test). App-shaped PostgREST path (`Prefer: return=representation`).

| Check | Result |
|-------|--------|
| A create trip + RETURNING | 201 |
| A reload by id | PASS |
| A edit + reload | PASS |
| B list does not include A trip | PASS |
| B direct fetch by id empty | PASS |
| B PATCH cannot mutate A trip | PASS |
| A name intact after B attempt | PASS |
| Cleanup users/trip | done |

## 6. RETURNING fix note

Initial Account A create with `return=representation` failed under `trips_select_member` because `is_trip_member()` re-queries `trips` and cannot see the in-flight insert.  
Migration `20260719120200_travel_buddy_trips_returning_select.sql` adds `(select auth.uid()) = owner_id OR is_trip_member(id)` so supabase-js `.insert/.upsert().select()` works.

## 7. Repository gate

| Check | Result |
|-------|--------|
| `npm run validate` | PASS — 42 files / 156 tests; build OK |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |

## 8. Gates

| # | Gate | Status |
|---|------|--------|
| 1 | Target project confirmation (`jtktojbvbmiewpntpvhe`) via CLI link | **PASS** |
| 2 | Apply migrations (5 remote versions) | **PASS** |
| 3 | Tables + private `travel-documents` bucket | **PASS** |
| 4 | RLS, grants, Data API | **PASS** |
| 5 | Security + performance advisors (executed; WARN-only) | **PASS** |
| 6 | `profiles` / `trips` non-404 | **PASS** |
| 7 | Account A persistence | **PASS** |
| 8 | Account B isolation | **PASS** |
| 9 | Repository validate / tests / build / audit | **PASS** |
