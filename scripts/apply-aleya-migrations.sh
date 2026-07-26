#!/usr/bin/env bash
# Apply Travel Buddy migrations to aleya travel assistant (jtktojbvbmiewpntpvhe) only.
# Requires: SUPABASE_ACCESS_TOKEN with access to organisation tasqkbrzxjralyelioyv.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-jtktojbvbmiewpntpvhe}"
EXPECTED_ORG="${SUPABASE_EXPECTED_ORG:-tasqkbrzxjralyelioyv}"
EXPECTED_NAME_SUBSTR="${SUPABASE_EXPECTED_NAME_SUBSTR:-aleya travel assistant}"
API="${SUPABASE_MANAGEMENT_API:-https://api.supabase.com}"

FORBIDDEN_REFS=(
  farnjmgwcayvkzuaoifk
  iwmloenntlzyzvguwfsn
  bmfpclozzmeekazmoaxw
  wrmwthsfbpkjsxsqigpw
)

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN. Create a personal access token with access to org ${EXPECTED_ORG}." >&2
  exit 1
fi

for forbidden in "${FORBIDDEN_REFS[@]}"; do
  if [[ "${PROJECT_REF}" == "${forbidden}" ]]; then
    echo "Refusing: forbidden project ref ${forbidden}" >&2
    exit 1
  fi
done

if [[ "${PROJECT_REF}" != "jtktojbvbmiewpntpvhe" ]]; then
  echo "Refusing: only jtktojbvbmiewpntpvhe (aleya travel assistant) is allowed (got ${PROJECT_REF})." >&2
  exit 1
fi

echo "Verifying project ${PROJECT_REF} belongs to organisation ${EXPECTED_ORG}..."
PROJECT_JSON=$(curl -fsS \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  "${API}/v1/projects/${PROJECT_REF}")

ORG_ID=$(printf '%s' "${PROJECT_JSON}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("organization_id") or d.get("organization_slug") or "")')
NAME=$(printf '%s' "${PROJECT_JSON}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("name") or "")')
REF=$(printf '%s' "${PROJECT_JSON}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id") or d.get("ref") or "")')

echo "  name=${NAME}"
echo "  ref=${REF}"
echo "  organization_id=${ORG_ID}"

if [[ "${REF}" != "jtktojbvbmiewpntpvhe" ]]; then
  echo "Refusing: Management API returned unexpected ref ${REF}" >&2
  exit 1
fi

if [[ "${ORG_ID}" != "${EXPECTED_ORG}" ]]; then
  echo "Refusing: organisation ${ORG_ID} is not ${EXPECTED_ORG}" >&2
  exit 1
fi

NAME_LC=$(printf '%s' "${NAME}" | tr '[:upper:]' '[:lower:]')
EXPECTED_LC=$(printf '%s' "${EXPECTED_NAME_SUBSTR}" | tr '[:upper:]' '[:lower:]')
if [[ "${NAME_LC}" != *"${EXPECTED_LC}"* ]]; then
  echo "Refusing: project name '${NAME}' does not look like '${EXPECTED_NAME_SUBSTR}'" >&2
  exit 1
fi

echo "Organisation/project checks passed."

apply_sql() {
  local name="$1"
  local file="$2"
  if [[ ! -f "${file}" ]]; then
    echo "Missing migration file: ${file}" >&2
    exit 1
  fi
  echo "Applying ${name} from ${file}..."
  python3 - "$API" "$PROJECT_REF" "$SUPABASE_ACCESS_TOKEN" "$file" <<'PY'
import json, sys, urllib.error, urllib.request
api, ref, token, path = sys.argv[1:5]
sql = open(path, encoding='utf-8').read()
req = urllib.request.Request(
    f"{api}/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode()
        print(body[:800] if body else "ok")
except urllib.error.HTTPError as exc:
    err = exc.read().decode()
    print(err, file=sys.stderr)
    raise SystemExit(f"Migration failed HTTP {exc.code}")
PY
}

apply_sql foundation "$ROOT/supabase/migrations/20260718120000_travel_buddy_foundation.sql"
apply_sql storage "$ROOT/supabase/migrations/20260718120100_travel_buddy_storage.sql"
apply_sql hardening "$ROOT/supabase/migrations/20260719120000_travel_buddy_security_hardening.sql"
apply_sql grants "$ROOT/supabase/migrations/20260719120100_travel_buddy_launch_grants.sql"

echo "Verifying required tables exist..."
VERIFY_SQL=$(cat <<'SQL'
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles','trips','trip_collaborators','trip_templates',
    'trip_activity','sync_revisions','document_objects'
  )
order by table_name;
SQL
)
printf '%s' "${VERIFY_SQL}" | python3 - "$API" "$PROJECT_REF" "$SUPABASE_ACCESS_TOKEN" <<'PY'
import json, sys, urllib.request
api, ref, token = sys.argv[1:4]
sql = sys.stdin.read()
req = urllib.request.Request(
    f"{api}/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as resp:
    print(resp.read().decode()[:2000])
PY

echo "Migrations applied to ${PROJECT_REF} (org ${EXPECTED_ORG})."
