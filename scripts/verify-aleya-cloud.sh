#!/usr/bin/env bash
# Verify Aleya Travel Buddy cloud schema + anon isolation against jtktojbvbmiewpntpvhe.
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-jtktojbvbmiewpntpvhe}"
URL="${VITE_SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}"
PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"
API="${SUPABASE_MANAGEMENT_API:-https://api.supabase.com}"

if [[ -z "${PUBLISHABLE_KEY}" ]]; then
  echo "Missing VITE_SUPABASE_PUBLISHABLE_KEY" >&2
  exit 1
fi

if [[ "${URL}" == *"farnjmgwcayvkzuaoifk"* ]] || [[ "${PROJECT_REF}" != "jtktojbvbmiewpntpvhe" ]]; then
  echo "Refusing: wrong project" >&2
  exit 1
fi

echo "== PostgREST table probe (publishable key) =="
FAIL=0
for table in profiles trips trip_templates trip_collaborators trip_activity sync_revisions document_objects; do
  code=$(curl -s -o /tmp/tb_body -w '%{http_code}' \
    -H "apikey: ${PUBLISHABLE_KEY}" \
    -H "Authorization: Bearer ${PUBLISHABLE_KEY}" \
    "${URL}/rest/v1/${table}?select=*&limit=1")
  body=$(head -c 160 /tmp/tb_body)
  echo "  ${table}: HTTP ${code} ${body}"
  if [[ "${code}" == "404" ]]; then
    echo "FAIL: ${table} missing (PostgREST 404)" >&2
    FAIL=1
  fi
done
if [[ "${FAIL}" -ne 0 ]]; then
  exit 1
fi

echo "== Anon must not read private trip rows =="
curl -s -H "apikey: ${PUBLISHABLE_KEY}" -H "Authorization: Bearer ${PUBLISHABLE_KEY}" \
  "${URL}/rest/v1/trips?select=id,owner_id,name&limit=5" -o /tmp/anon_trips.json
python3 - <<'PY'
import json
data=json.load(open('/tmp/anon_trips.json'))
if isinstance(data, list) and len(data) > 0:
    raise SystemExit(f'FAIL: anon saw {len(data)} trips')
print('  anon trips response ok:', data)
PY

echo "== Storage bucket travel-documents =="
curl -s -o /tmp/bucket.json -w 'HTTP %{http_code}\n' \
  -H "apikey: ${PUBLISHABLE_KEY}" -H "Authorization: Bearer ${PUBLISHABLE_KEY}" \
  "${URL}/storage/v1/bucket/travel-documents"
head -c 300 /tmp/bucket.json; echo

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "== RLS enabled on public tables =="
  python3 - "$API" "$PROJECT_REF" "$SUPABASE_ACCESS_TOKEN" <<'PY'
import json, sys, urllib.request
api, ref, token = sys.argv[1:4]
sql = """
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles','trips','trip_collaborators','trip_templates',
    'trip_activity','sync_revisions','document_objects'
  )
order by 1;
"""
req = urllib.request.Request(
    f"{api}/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)
rows = json.loads(urllib.request.urlopen(req).read().decode())
print(json.dumps(rows, indent=2)[:2000])
if isinstance(rows, list):
    bad = [r for r in rows if not (r.get('rls_enabled') or r.get('relrowsecurity'))]
    # Management API may return [{table_name, rls_enabled}] or nested
    for r in rows:
        enabled = r.get('rls_enabled')
        if enabled is False:
            raise SystemExit(f"FAIL: RLS disabled on {r}")
print('  RLS check done')
PY

  echo "== Grants for authenticated on helper functions =="
  python3 - "$API" "$PROJECT_REF" "$SUPABASE_ACCESS_TOKEN" <<'PY'
import json, sys, urllib.request
api, ref, token = sys.argv[1:4]
sql = """
select p.proname, r.rolname as grantee
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a on true
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public'
  and p.proname in ('is_trip_member','can_edit_trip','trip_role','storage_trip_id')
  and r.rolname in ('authenticated','anon','public')
order by 1,2;
"""
req = urllib.request.Request(
    f"{api}/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)
print(urllib.request.urlopen(req).read().decode()[:2000])
PY
else
  echo "(SUPABASE_ACCESS_TOKEN unset — skipped SQL RLS/grants checks)"
fi

echo "verify-aleya-cloud: completed."
