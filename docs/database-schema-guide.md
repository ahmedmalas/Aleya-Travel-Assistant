# Database schema guide (ALEYA / Travel Buddy)

Production project ref: `jtktojbvbmiewpntpvhe` (retired ref denylisted).

## Core tables (foundation migration)

- `profiles` — display name, currency, timezone, notification preferences
- `trips` — vault trip payloads / owner isolation via `owner_id`
- Collaboration / invitation tables as defined in foundation + hardening migrations
- Document metadata rows linked to private Storage objects

## Storage

- Private bucket paths: `userId/tripId/docId/file`
- Signed URL download only; no public object URLs in app state for sharing

## RLS principles

- Account isolation by `auth.uid()` = `owner_id` (and collaborator grants where accepted)
- Viewers cannot mutate; editors cannot manage members; owners can revoke
- Storage policies deny cross-account object access
- Admin capabilities are not granted by UI hiding — use `app_role` / allowlist + server checks

## Local vault

Browser vault (`travel-buddy:trip-vault:v1`) mirrors trip domain for offline/demo and syncs to cloud when signed in.
