# SecureTask — Phase 2 QA Security Automation (Cucumber + Playwright)

BDD security regression suite for the SecureTask app. Scenarios are written in
Gherkin (`@cucumber/cucumber`) and driven by **Playwright** (browser + API),
**not** Playwright's native test runner.

These tests encode the **expected secure behaviour** for all six vulnerability
categories, so they double as fix-verification: against the hardened app every
scenario should pass.

## Coverage

| Feature file                     | Category               | How it tests                                                                 |
| -------------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| `sql-injection.feature`          | SQL Injection          | API + dashboard search with `' OR '1'='1` etc.; payload must stay literal   |
| `xss.feature`                    | Stored XSS             | Task description & profile bio payloads; no JS dialog fires, rendered as text |
| `auth.feature`                   | Auth / Authz           | Unauth 401, admin-as-user 403, horizontal escalation, mass-assignment, client role tamper |
| `insecure-data-storage.feature`  | Insecure Data Storage  | No JWT/password in web storage; HttpOnly cookie; only safe user fields stored |
| `hardcoded-credentials.feature`  | Hardcoded Credentials  | Static source scan + env-var usage checks                                    |
| `brute-force.feature`            | Brute Force            | Repeated failed logins must be throttled (429 + Retry-After)                 |

## Layout

```
qa/automation/
├── cucumber.js                 # Cucumber runner config
├── package.json
├── features/                   # Gherkin .feature files (one per category)
├── formatters/
│   └── scenario-status-formatter.js  # per-scenario/step PASS-FAIL + timing output
├── steps/                      # Playwright-backed step definitions
│   └── common.steps.js         # shared Given/Then (login, status assertions)
├── support/
│   ├── config.js               # URLs, seed accounts, payloads, headed/slowMo, evidence dir
│   ├── world.js                # custom World: Playwright browser + API contexts
│   └── hooks.js                # evidence capture + teardown
└── evidence/                   # generated screenshots / transcripts (per run)
```

## Prerequisites

1. **App running** — frontend at `http://localhost:5173`, backend at
   `http://localhost:8080/api` (e.g. `docker-compose up`).
2. Seeded accounts exist (created automatically by the backend): `user@example.com` / `password123`.
3. Node 18+.

## Install & run

```bash
cd qa/automation
npm install               # installs deps + Chromium (postinstall)
# npx playwright install chromium   # run manually if postinstall was skipped

npm test                  # run all features (headless), per-scenario PASS/FAIL + timing
npm run test:headed       # visible browser (HEADED=1 SLOWMO=300) — watch it drive localhost
npm run test:compact      # dots-only progress bar
npm run test:sql          # a single category
npm run test:xss
npm run test:auth
npm run test:storage
npm run test:secrets
npm run test:bruteforce
```

### Output & evidence

- **Console**: a custom formatter ([formatters/scenario-status-formatter.js](formatters/scenario-status-formatter.js))
  prints every feature → scenario → step with a `[PASS]`/`[FAIL]` label and its
  execution time, ending in a totals block. Failures print the assertion message
  inline.
- **Evidence** (`evidence/<feature>/<scenario>__<STATUS>.png|.txt`): every
  scenario produces an artifact. Browser scenarios save a **full-page
  screenshot** of localhost; API scenarios save a **response transcript**. The
  directory is wiped at the start of each run. Artifacts are also attached to the
  HTML report.
- **HTML report**: `reports/cucumber-report.html` (open in a browser; embeds the
  screenshots). **Summary**: `reports/summary.txt`.

Run headed (`npm run test:headed`) to see Chromium actually open localhost,
log in, type payloads, and navigate — standard Playwright UI automation.

## Configuration (env vars)

| Variable        | Default                       | Purpose                          |
| --------------- | ----------------------------- | -------------------------------- |
| `FRONTEND_URL`  | `http://localhost:5173`       | Frontend base URL                |
| `API_BASE_URL`  | `http://localhost:8080/api`   | Backend API base URL             |
| `HEADED=1`      | _(headless)_                  | Run the browser headed for debug |

## Notes

- API and UI logical users get isolated Playwright contexts (separate cookie
  jars), so sessions never bleed across scenarios.
- The brute-force scenario targets a **unique throwaway email per run**. The
  backend throttles on IP + email, so it locks out only that address and never
  the seeded accounts the UI scenarios rely on.
- `hardcoded-credentials.feature` is a static filesystem scan (no app needed);
  it walks `frontend/src`, `backend`, and config files from the repo root.
