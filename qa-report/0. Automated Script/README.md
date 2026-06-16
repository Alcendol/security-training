# SecureTask Automated Security Tests

This folder contains automated security checks derived from the QA reports and manual test cases.

## Prerequisites

- Node.js 18 or newer
- Backend running at `http://localhost:8080`
- Database running and migrated
- Frontend source available in this repository

The script uses only Node built-ins. No `npm install` is required.

## Run

From the repository root:

```powershell
node "qa-report\0. Automated Script\run-security-tests.mjs"
```

Optional environment variables:

```powershell
$env:API_BASE_URL="http://localhost:8080/api"
$env:FRONTEND_URL="http://localhost:5173"
$env:SKIP_BRUTE_FORCE="1"
node "qa-report\0. Automated Script\run-security-tests.mjs"
```

Run only source-code checks without touching the API/database:

```powershell
$env:STATIC_ONLY="1"
node "qa-report\0. Automated Script\run-security-tests.mjs"
Remove-Item Env:\STATIC_ONLY
```

## What It Covers

- SQL injection regression for task search
- Stored XSS regression through task and profile API responses
- Authentication and authorization checks for protected endpoints
- Mass assignment checks
- CORS origin restriction checks
- Password exposure checks
- Token storage and cookie checks
- Sensitive logging and hardcoded secret source checks
- Weak password policy checks
- Brute force throttling check

## Result Meaning

- `PASS`: secure behavior was observed.
- `FAIL`: vulnerable behavior or risky source pattern was observed.
- `SKIP`: required runtime service or prerequisite was unavailable.

The script exits with code `1` if any test fails. This is intentional so it can be used later in CI or regression testing.