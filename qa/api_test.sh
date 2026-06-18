#!/usr/bin/env bash
#
# api_test.sh — End-to-end smoke + edge-case test for the SecureTask API.
#
# Exercises every route registered in backend/main.go and asserts the
# expected HTTP status code for each. For every test it prints (to the
# terminal) and records (to a Markdown report) the HTTP method, endpoint
# URL, request payload, expected vs actual status, and the response JSON.
#
# Coverage includes happy paths, validation branches, authorization /
# IDOR (cross-user access), RBAC, and JWT handling (alg=none, raw token).
#
# Authentication uses the auth_token cookie set by /api/auth/login
# (stored in a per-run cookie jar).
#
# Usage:
#   ./qa/api_test.sh                      # test + write qa/API-TEST-REPORT.md
#   BASE_URL=http://host:8080 ./qa/api_test.sh
#   QUIET=1 ./qa/api_test.sh              # hide request/response detail on screen
#   REPORT_FILE=/path/report.md ./qa/api_test.sh   # custom report path
#   NO_REPORT=1 ./qa/api_test.sh          # skip report generation
#
# Requires: curl, jq. Exits non-zero if any assertion fails.

set -u

BASE_URL="${BASE_URL:-http://localhost:8080}"
API="$BASE_URL/api"
QUIET="${QUIET:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="${REPORT_FILE:-$SCRIPT_DIR/API-TEST-REPORT.md}"
NO_REPORT="${NO_REPORT:-0}"

# Unique email so re-runs don't collide on the unique-email constraint.
RUN_ID="$(date +%s)$$"
NEW_EMAIL="qa_user_${RUN_ID}@example.com"
NEW_PASS="Passw0rd123"

# Cookie jars (one per identity) + report body buffer.
JAR_DIR="$(mktemp -d)"
USER_JAR="$JAR_DIR/user.txt"
ADMIN_JAR="$JAR_DIR/admin.txt"
BODY_TMP="$JAR_DIR/report_body.md"
: > "$BODY_TMP"
trap 'rm -rf "$JAR_DIR"' EXIT

# --- Helpers -----------------------------------------------------------------
# repeat <count> [char] — emit a string of <count> identical chars (for max-len tests).
repeat() { head -c "$1" < /dev/zero | tr '\0' "${2:-a}"; }

# b64url — read stdin, emit base64url (no padding). Used to craft JWTs.
b64url() { base64 | tr -d '\n' | tr '+/' '-_' | tr -d '='; }

# md <text...> — append a line to the Markdown report body.
md() { printf '%s\n' "$*" >> "$BODY_TMP"; }

# pretty_plain <json> — pretty-print without ANSI color (for the report file).
pretty_plain() {
  local body="$1"
  if [[ -z "$body" ]]; then echo "(empty)"
  elif echo "$body" | jq -e . >/dev/null 2>&1; then echo "$body" | jq .
  else echo "$body" | head -c 400; fi
}

# --- Pretty terminal output --------------------------------------------------
GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RST=$'\033[0m'
PASS_COUNT=0
FAIL_COUNT=0

# Per-section tallies for the report summary table.
declare -a SEC_NAME SEC_PASS SEC_TOTAL
CUR_SEC=-1

section() {
  printf "\n${YELLOW}${BOLD}══ %s ══${RST}\n" "$1"
  CUR_SEC=$((CUR_SEC + 1))
  SEC_NAME[$CUR_SEC]="$1"; SEC_PASS[$CUR_SEC]=0; SEC_TOTAL[$CUR_SEC]=0
  md ""
  md "### $1"
}

# bump <pass|fail> — record a result against global + current-section tallies.
bump() {
  SEC_TOTAL[$CUR_SEC]=$(( ${SEC_TOTAL[$CUR_SEC]} + 1 ))
  if [[ "$1" == pass ]]; then
    PASS_COUNT=$((PASS_COUNT + 1)); SEC_PASS[$CUR_SEC]=$(( ${SEC_PASS[$CUR_SEC]} + 1 ))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# pretty <json> — pretty-print if valid JSON (colored), else echo raw (truncated).
pretty() {
  local body="$1"
  if [[ -z "$body" ]]; then echo "(empty)"
  elif echo "$body" | jq -e . >/dev/null 2>&1; then echo "$body" | jq -C .
  else echo "$body" | head -c 400; fi
}

# t <name> <expected_status> <METHOD> <path> <jar> [json_body] [extra_header]
# Performs the request, prints full detail, records pass/fail, and appends to the report.
t() {
  local name="$1" expected="$2" method="$3" url="$4" jar="$5" data="${6:-}" header="${7:-}"

  local args=(-s -w $'\n%{http_code}' -X "$method" -H "Content-Type: application/json")
  [[ -n "$jar" ]]    && args+=(-b "$jar" -c "$jar")
  [[ -n "$data" ]]   && args+=(-d "$data")
  [[ -n "$header" ]] && args+=(-H "$header")

  local raw status body
  raw="$(curl "${args[@]}" "$url")"
  status="$(tail -n1 <<<"$raw")"
  body="$(sed '$d' <<<"$raw")"

  local ok mark badge
  if [[ "$status" == "$expected" ]]; then
    ok=pass; mark="${GREEN}✓ PASS${RST}"; badge="✅ PASS"
  else
    ok=fail; mark="${RED}✗ FAIL${RST}"; badge="❌ FAIL"
  fi
  bump "$ok"

  # --- terminal ---
  printf "\n${BOLD}%s${RST}  [%s]\n" "$name" "$mark"
  printf "  ${CYAN}%s${RST} %s\n" "$method" "$url"
  [[ -n "$header" ]] && printf "  ${DIM}header:${RST} %s\n" "$header"
  [[ -n "$jar" ]]    && printf "  ${DIM}auth:${RST}   cookie jar %s\n" "$(basename "$jar")"
  if [[ -n "$data" ]]; then
    printf "  ${DIM}request:${RST}\n"; pretty "$data" | sed 's/^/    /'
  fi
  if [[ "$ok" == pass ]]; then
    printf "  ${DIM}status:${RST}  %s (expected %s)\n" "$status" "$expected"
  else
    printf "  ${RED}status:  %s (expected %s)${RST}\n" "$status" "$expected"
  fi
  if [[ "$QUIET" != "1" ]]; then
    printf "  ${DIM}response:${RST}\n"; pretty "$body" | sed 's/^/    /'
  fi

  # --- report ---
  md ""
  md "#### ${badge} — ${name}"
  md ""
  md "\`${method}\` \`${url}\`"
  [[ -n "$header" ]] && { md ""; md "- header: \`${header}\`"; }
  [[ -n "$jar" ]]    && { md ""; md "- auth: cookie jar \`$(basename "$jar")\`"; }
  if [[ -n "$data" ]]; then
    md ""; md "Request:"; md '```json'; pretty_plain "$data" >> "$BODY_TMP"; md '```'
  fi
  md ""
  md "Response — status \`${status}\` (expected \`${expected}\`):"
  md '```json'; pretty_plain "$body" >> "$BODY_TMP"; md '```'

  # Expose last response body for callers that need to extract IDs.
  LAST_BODY="$body"
}

printf "${YELLOW}${BOLD}SecureTask API test suite${RST}\n"
printf "Target: %s\n" "$BASE_URL"

# --- 0. Reachability ---------------------------------------------------------
if ! curl -s -o /dev/null --max-time 5 "$BASE_URL" 2>/dev/null; then
  printf "${RED}ERROR:${RST} cannot reach %s — is the server running?\n" "$BASE_URL"
  exit 1
fi

# --- 1. Auth: registration ---------------------------------------------------
section "Auth — registration"

t "register new user" 201 \
  POST "$API/auth/register" "" "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS\",\"name\":\"QA User\"}"

t "register duplicate -> 409" 409 \
  POST "$API/auth/register" "" "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS\",\"name\":\"QA User\"}"

t "register bad email + short pw -> 400" 400 \
  POST "$API/auth/register" "" "{\"email\":\"bad\",\"password\":\"x\",\"name\":\"\"}"

t "register weak pw (no digit) -> 400" 400 \
  POST "$API/auth/register" "" "{\"email\":\"weak_${RUN_ID}@example.com\",\"password\":\"onlyletters\",\"name\":\"Weak\"}"

t "register over-length name -> 400" 400 \
  POST "$API/auth/register" "" "{\"email\":\"long_${RUN_ID}@example.com\",\"password\":\"$NEW_PASS\",\"name\":\"$(repeat 101)\"}"

t "register empty body -> 400" 400 \
  POST "$API/auth/register" "" "{}"

# --- 2. Auth: login ----------------------------------------------------------
section "Auth — login"

t "login new user" 200 \
  POST "$API/auth/login" "$USER_JAR" "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS\"}"

t "login wrong password -> 401" 401 \
  POST "$API/auth/login" "" "{\"email\":\"$NEW_EMAIL\",\"password\":\"wrong\"}"

t "login non-existent email -> 401" 401 \
  POST "$API/auth/login" "" "{\"email\":\"nobody_${RUN_ID}@example.com\",\"password\":\"$NEW_PASS\"}"

t "login empty body -> 400" 400 \
  POST "$API/auth/login" "" "{}"

t "login seeded admin" 200 \
  POST "$API/auth/login" "$ADMIN_JAR" "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"

# --- 3. Auth enforcement & JWT handling -------------------------------------
section "Auth enforcement & JWT handling"

t "tasks without auth -> 401" 401 \
  GET "$API/tasks" ""

t "invalid token -> 401" 401 \
  GET "$API/users/me" "" "" "Authorization: Bearer not.a.real.token"

# JWT alg-confusion: an unsigned (alg=none) token must be rejected.
NONE_HEADER="$(printf '{"alg":"none","typ":"JWT"}' | b64url)"
NONE_PAYLOAD="$(printf '{"user_id":1,"email":"admin@example.com","role":"admin","exp":9999999999}' | b64url)"
NONE_TOKEN="${NONE_HEADER}.${NONE_PAYLOAD}."
t "alg=none forged token -> 401" 401 \
  GET "$API/users/me" "" "" "Authorization: Bearer ${NONE_TOKEN}"

# Middleware also accepts a raw token (no "Bearer " prefix). Pull it from the jar.
USER_TOKEN="$(awk '/auth_token/ {print $7}' "$USER_JAR")"
t "raw token (no Bearer prefix) -> 200" 200 \
  GET "$API/users/me" "" "" "Authorization: ${USER_TOKEN}"

# --- 4. Users ----------------------------------------------------------------
section "Users"

t "get current user" 200 \
  GET "$API/users/me" "$USER_JAR"
USER_ID=$(echo "$LAST_BODY" | jq -r '.id')

t "update own profile" 200 \
  PUT "$API/users/$USER_ID/profile" "$USER_JAR" '{"name":"QA User Updated","bio":"hello"}'

t "update other user's profile -> 403" 403 \
  PUT "$API/users/999999/profile" "$USER_JAR" '{"bio":"x"}'

t "update profile non-numeric id -> 400" 400 \
  PUT "$API/users/abc/profile" "$USER_JAR" '{"bio":"x"}'

t "update profile over-length name -> 400" 400 \
  PUT "$API/users/$USER_ID/profile" "$USER_JAR" "{\"name\":\"$(repeat 101)\"}"

t "admin list users" 200 \
  GET "$API/admin/users" "$ADMIN_JAR"

t "non-admin list users -> 403" 403 \
  GET "$API/admin/users" "$USER_JAR"

# --- 5. Tasks ----------------------------------------------------------------
section "Tasks"

t "create task" 201 \
  POST "$API/tasks" "$USER_JAR" '{"title":"Write tests","description":"cover all endpoints","priority":"high"}'
TASK_ID=$(echo "$LAST_BODY" | jq -r '.id')

t "create minimal task (title only) -> 201" 201 \
  POST "$API/tasks" "$USER_JAR" '{"title":"Minimal task"}'
MIN_TASK_ID=$(echo "$LAST_BODY" | jq -r '.id')

t "create task missing title -> 400" 400 \
  POST "$API/tasks" "$USER_JAR" '{"description":"no title"}'

t "create task invalid priority -> 400" 400 \
  POST "$API/tasks" "$USER_JAR" '{"title":"x","priority":"urgent"}'

t "create task over-length title -> 400" 400 \
  POST "$API/tasks" "$USER_JAR" "{\"title\":\"$(repeat 201)\"}"

t "list tasks" 200 \
  GET "$API/tasks" "$USER_JAR"

t "update task" 200 \
  PUT "$API/tasks/$TASK_ID" "$USER_JAR" '{"status":"in_progress","priority":"low"}'

t "update task invalid status -> 400" 400 \
  PUT "$API/tasks/$TASK_ID" "$USER_JAR" '{"status":"bogus"}'

t "update task invalid priority -> 400" 400 \
  PUT "$API/tasks/$TASK_ID" "$USER_JAR" '{"priority":"urgent"}'

t "search tasks (match)" 200 \
  GET "$API/tasks/search?q=tests" "$USER_JAR"

t "search tasks (no match) -> 200 []" 200 \
  GET "$API/tasks/search?q=zzz_no_such_task" "$USER_JAR"

t "search no term -> 400" 400 \
  GET "$API/tasks/search" "$USER_JAR"

t "update missing task -> 404" 404 \
  PUT "$API/tasks/999999" "$USER_JAR" '{"status":"done"}'

t "delete minimal task" 200 \
  DELETE "$API/tasks/$MIN_TASK_ID" "$USER_JAR"

t "delete task" 200 \
  DELETE "$API/tasks/$TASK_ID" "$USER_JAR"

t "delete missing task -> 404" 404 \
  DELETE "$API/tasks/$TASK_ID" "$USER_JAR"

# --- 6. Authorization / IDOR (cross-user task access) ------------------------
section "Authorization / IDOR"

# Admin creates a task; the regular user must not be able to touch it.
t "admin creates a task" 201 \
  POST "$API/tasks" "$ADMIN_JAR" '{"title":"Admin private task","priority":"high"}'
ADMIN_TASK_ID=$(echo "$LAST_BODY" | jq -r '.id')

t "user reads own tasks only" 200 \
  GET "$API/tasks" "$USER_JAR"

# Explicit leak check: admin's task id must NOT appear in the user's list.
if echo "$LAST_BODY" | jq -e --arg id "$ADMIN_TASK_ID" 'any(.[]; .id == ($id|tonumber))' >/dev/null 2>&1; then
  printf "  ${RED}✗ leak: admin task %s visible to user${RST}\n" "$ADMIN_TASK_ID"
  bump fail
  md ""; md "#### ❌ FAIL — leak check: admin task not in user's list"
  md ""; md "Admin task id \`${ADMIN_TASK_ID}\` **was** present in the user's \`GET /api/tasks\` response."
else
  printf "  ${GREEN}✓ admin task %s not in user's list${RST}\n" "$ADMIN_TASK_ID"
  bump pass
  md ""; md "#### ✅ PASS — leak check: admin task not in user's list"
  md ""; md "Admin task id \`${ADMIN_TASK_ID}\` is absent from the user's \`GET /api/tasks\` response."
fi

t "user updates admin's task -> 404 (IDOR)" 404 \
  PUT "$API/tasks/$ADMIN_TASK_ID" "$USER_JAR" '{"status":"done"}'

t "user deletes admin's task -> 404 (IDOR)" 404 \
  DELETE "$API/tasks/$ADMIN_TASK_ID" "$USER_JAR"

t "admin deletes own task (cleanup)" 200 \
  DELETE "$API/tasks/$ADMIN_TASK_ID" "$ADMIN_JAR"

# --- 7. Logout ---------------------------------------------------------------
section "Logout"

t "logout" 200 \
  POST "$API/auth/logout" "$USER_JAR"

# --- Summary (terminal) ------------------------------------------------------
TOTAL=$((PASS_COUNT + FAIL_COUNT))
printf "\n${YELLOW}${BOLD}══ Summary ══${RST}\n"
printf "  Total:  %d\n" "$TOTAL"
printf "  ${GREEN}Passed: %d${RST}\n" "$PASS_COUNT"
[[ "$FAIL_COUNT" -gt 0 ]] && printf "  ${RED}Failed: %d${RST}\n" "$FAIL_COUNT"

# --- Report generation -------------------------------------------------------
if [[ "$NO_REPORT" != "1" ]]; then
  RESULT_BADGE="✅ **${PASS_COUNT} / ${TOTAL} passed**"
  [[ "$FAIL_COUNT" -gt 0 ]] && RESULT_BADGE="❌ **${FAIL_COUNT} of ${TOTAL} failed**"

  {
    cat <<EOF
# SecureTask API — Functional Test Report

> Auto-generated by [\`qa/api_test.sh\`](./api_test.sh). Do not edit by hand —
> re-run the script to regenerate.

**Target:** \`${BASE_URL}\`
**Generated:** $(date '+%Y-%m-%d %H:%M:%S %Z')
**Result:** ${RESULT_BADGE}

This report exercises every route registered in
[\`backend/main.go\`](../backend/main.go) and asserts the expected HTTP status
code for each — covering happy paths, validation branches, authorization /
IDOR (cross-user access), RBAC, and JWT handling. Request and response bodies
below are captured live from this run.

## How to run

\`\`\`bash
./qa/api_test.sh                      # run tests + regenerate this report
QUIET=1 ./qa/api_test.sh              # quieter terminal output
BASE_URL=http://host:8080 ./qa/api_test.sh
NO_REPORT=1 ./qa/api_test.sh          # skip report generation
\`\`\`

Prerequisites: \`curl\`, \`jq\`, a running backend on \`:8080\`, and a
migrated/seeded database. Exits non-zero if any assertion fails.

## Endpoint coverage

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | \`/api/auth/register\` | public |
| POST | \`/api/auth/login\` | public |
| POST | \`/api/auth/logout\` | public |
| GET | \`/api/tasks\` | cookie/JWT |
| POST | \`/api/tasks\` | cookie/JWT |
| PUT | \`/api/tasks/:id\` | cookie/JWT |
| GET | \`/api/tasks/search\` | cookie/JWT |
| DELETE | \`/api/tasks/:id\` | cookie/JWT |
| GET | \`/api/users/me\` | cookie/JWT |
| PUT | \`/api/users/:id/profile\` | cookie/JWT |
| GET | \`/api/admin/users\` | cookie/JWT + admin |

## Results summary

| Section | Tests | Passed |
|---------|------:|-------:|
EOF
    for i in "${!SEC_NAME[@]}"; do
      printf "| %s | %d | %d |\n" "${SEC_NAME[$i]}" "${SEC_TOTAL[$i]}" "${SEC_PASS[$i]}"
    done
    printf "| **Total** | **%d** | **%d** |\n" "$TOTAL" "$PASS_COUNT"

    printf "\n## Detailed results\n"
    cat "$BODY_TMP"

    cat <<'EOF'

## Notes

- Registration creates persistent users (`qa_user_*`, `weak_*`, `long_*`); there
  is no user-deletion endpoint, so these accumulate in the database across runs.
- The IDOR section is self-cleaning — the admin task it creates is deleted at the
  end of that section.
- Task create/update/search responses include a populated nested `user` object
  (fixed via `Preload("User")` in `backend/handlers/tasks.go`).
EOF
  } > "$REPORT_FILE"

  printf "  ${CYAN}Report written: %s${RST}\n" "$REPORT_FILE"
fi

[[ "$FAIL_COUNT" -gt 0 ]] && exit 1
printf "  ${GREEN}All tests passed.${RST}\n"
