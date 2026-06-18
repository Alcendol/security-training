# Developer Fix Verification Tests

**Source**: Developer fix documentation spreadsheet and current security guides  
**Purpose**: Verify fixed behavior that is not fully covered by the original vulnerability reports

These tests are regression checks, not new vulnerability reports. Use them to confirm the developer fixes continue to behave securely.

## TC-FIX-001: Forged or Unsigned JWT Is Rejected

**Developer Fix Coverage**: Backend `AuthMiddleware` signing-method validation  
**Priority**: High  
**Category**: Authentication, Token Validation  
**Component**: Backend, API  
**Endpoint/Page**: Protected API endpoints

### Objective
Verify that the backend rejects forged JWTs, including unsigned `alg:none` tokens.

### Preconditions
- Backend is running.
- No valid login session is required for this test.

### Test Data

Unsigned `alg:none` token claiming admin role:

```text
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiZXhwIjo0MTAyNDQ0ODAwfQ.
```

### Test Steps

1. Send a protected API request with the forged token.

```bash
curl -i "http://localhost:8080/api/admin/users" \
  -H "Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiZXhwIjo0MTAyNDQ0ODAwfQ."
```

2. Repeat against another protected endpoint.

```bash
curl -i "http://localhost:8080/api/tasks" \
  -H "Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiZXhwIjo0MTAyNDQ0ODAwfQ."
```

### Expected Vulnerable Result
- Forged token is accepted.
- Attacker can access protected or admin data without a valid signature.

### Expected Secure Result
- API returns `401 Unauthorized`.
- No protected data is returned.
- Backend validates that the token uses the expected HMAC signing method and secret.

### Actual Result
To be completed during execution.

### Status
- [ ] Pass
- [ ] Fail
- [ ] Blocked

### Evidence
Attach HTTP status and response body.

## TC-FIX-002: Task Create and Update Enforce Validation Rules

**Developer Fix Coverage**: Task request DTOs, length limits, enum validation, HTML escaping  
**Priority**: High  
**Category**: Input Validation, XSS, Mass Assignment  
**Component**: Backend, API  
**Endpoint/Page**: `POST /api/tasks`, `PUT /api/tasks/:id`

### Objective
Verify that task creation and update accept only valid fields and allowed values.

### Preconditions
- Backend is running.
- Tester is authenticated as a regular user.
- Tester has at least one task ID for update tests.

### Test Data

Invalid create/update examples:

```json
{"description":"Missing required title","priority":"medium"}
{"title":"Valid title","description":"Valid description","priority":"urgent"}
{"title":"Valid title","description":"<img src=x onerror=alert('XSS')>","priority":"medium"}
{"status":"invalid_status"}
{"user_id":1,"title":"Mass assignment attempt"}
```

### Test Steps

1. Create a task without a title.
2. Create a task with invalid priority `urgent`.
3. Create a task with an XSS payload in the description.
4. Update an existing task with invalid status `invalid_status`.
5. Update an existing task with protected field `user_id`.
6. Confirm valid task creation and valid status updates still work.

### Expected Vulnerable Result
- Invalid priority or status is accepted.
- Missing title is accepted.
- Protected field `user_id` changes task ownership.
- XSS payload is stored as executable HTML.

### Expected Secure Result
- Missing required title returns `400 Bad Request`.
- Invalid priority/status returns `400 Bad Request`.
- Protected fields such as `user_id` are ignored or rejected.
- XSS payload is escaped or rendered as harmless text.
- Valid create/update operations still succeed.

### Actual Result
To be completed during execution.

### Status
- [ ] Pass
- [ ] Fail
- [ ] Blocked

### Evidence
Attach request payloads, response codes, and response bodies.

## TC-FIX-003: Registration Enforces Server-Side Input Validation

**Developer Fix Coverage**: Register request validation, password rules, name escaping  
**Priority**: Medium  
**Category**: Input Validation, Authentication  
**Component**: Backend, Frontend, API  
**Endpoint/Page**: `POST /api/auth/register`, `/register`

### Objective
Verify that registration rejects invalid emails, invalid names, weak passwords, and malformed inputs on the backend.

### Preconditions
- Backend and frontend are running.
- Use unique test email addresses for each attempt.

### Test Data

| Field | Invalid Value | Expected Result |
|---|---|---|
| Email | `not-an-email` | Reject |
| Password | `123` | Reject |
| Password | `abcdefgh` | Reject, no number |
| Password | `12345678` | Reject, no letter |
| Name | empty string | Reject |
| Name | more than 100 characters | Reject |
| Name | `<img src=x onerror=alert(1)>` | Accept only if escaped/safe |

### Test Steps

1. Submit each invalid payload through the API.
2. Repeat representative invalid values through the Register UI.
3. Submit a valid payload, for example:

```json
{"email":"qa-valid@example.com","password":"StrongPass123!","name":"QA Valid"}
```

4. Confirm the valid payload succeeds.

### Expected Vulnerable Result
- Invalid emails or weak passwords are accepted.
- Long or empty names are accepted.
- HTML in names is stored unsafely.

### Expected Secure Result
- Invalid inputs return `400 Bad Request`.
- Weak passwords are rejected server-side.
- Name input is length-limited and escaped/safe.
- Valid registration still succeeds.

### Actual Result
To be completed during execution.

### Status
- [ ] Pass
- [ ] Fail
- [ ] Blocked

### Evidence
Attach API responses and UI screenshots.

## TC-FIX-004: UI No Longer Exposes Security Hints or Debug Data

**Developer Fix Coverage**: Removed dangerous placeholders, warning banners, debug panels, and security issue boxes  
**Priority**: Medium  
**Category**: Information Disclosure  
**Component**: Frontend  
**Endpoint/Page**: Login, Dashboard, Profile, Admin Panel, Register

### Objective
Verify that production-like UI does not expose exploit payload hints, default credentials, full user objects, or internal security issue descriptions.

### Preconditions
- Frontend is running.
- Tester can login as regular user and admin.
- Browser DevTools is available.

### Test Steps

1. Open Login page.
2. Confirm default test credentials are not displayed.
3. Login and open Dashboard.
4. Confirm there is no "Vulnerable Training App" warning banner.
5. Confirm search and task description placeholders do not suggest SQL injection or XSS payloads.
6. Open Profile.
7. Confirm there is no debug JSON dump of the user object.
8. Open Admin Panel as admin.
9. Confirm there is no security warning box describing internal vulnerabilities.
10. Open DevTools Console during login, register, profile update, and admin load.
11. Confirm no credentials, tokens, request bodies, or full response bodies are logged.

### Expected Vulnerable Result
- UI displays default credentials.
- Placeholders suggest attack payloads.
- Debug panels expose full user objects.
- Console logs contain credentials, tokens, or full API response data.

### Expected Secure Result
- UI contains no exploit hints or default passwords.
- Debug/security warning panels are removed.
- Console logging is removed or development-only and redacted.

### Actual Result
To be completed during execution.

### Status
- [ ] Pass
- [ ] Fail
- [ ] Blocked

### Evidence
Attach screenshots for each page and console output.

## TC-FIX-005: Git History and Source Do Not Contain Real Secrets

**Developer Fix Coverage**: Environment-based secrets, `.env` ignored, placeholder-only examples  
**Priority**: High  
**Category**: Hardcoded Secrets  
**Component**: Repository, Backend, Frontend  
**Endpoint/Page**: Not endpoint-specific

### Objective
Verify that secrets are not present in current source files or Git history, except clearly documented local training placeholders.

### Preconditions
- Repository is available locally.
- Tester can run Git and search commands.

### Test Steps

1. Search current source files for known secret patterns.

```bash
rg -n "supersecret123|admin-key-12345|AKIA|secretKey|DEFAULT_CREDENTIALS|DB_CONNECTION|JWT_SECRET|DB_PASSWORD|POSTGRES_PASSWORD|taskpass123" .
```

2. Check whether `.env` files are tracked.

```bash
git ls-files | rg "(^|/)\\.env$|\\.env\\."
```

3. Check Git history for committed `.env` files.

```bash
git log --all --full-history -- "**/.env"
```

4. Review any matches and classify them as real secret, local training placeholder, or documentation-only evidence.

### Expected Vulnerable Result
- Real secrets are committed in current files.
- `.env` files with real values are tracked.
- Git history contains real secrets without documented rotation.

### Expected Secure Result
- No real secrets are found in source or history.
- `.env` is ignored.
- Any example file uses placeholders only.
- If old secrets appear in history, rotation/remediation is documented.

### Actual Result
To be completed during execution.

### Status
- [ ] Pass
- [ ] Fail
- [ ] Blocked

### Evidence
Attach command output with secret values redacted.

## TC-FIX-006: Browser-Level XSS and LocalStorage Role Tampering Do Not Bypass Security

**Developer Fix Coverage**: Safe frontend rendering, httpOnly cookie auth, server-side admin authorization  
**Priority**: High  
**Category**: Browser Regression, XSS, Authorization  
**Component**: Frontend, Backend, API  
**Endpoint/Page**: Dashboard, Profile, Admin Panel

### Objective
Verify in a real browser that XSS payloads do not execute and localStorage role tampering does not grant backend admin access.

### Preconditions
- Frontend and backend are running.
- Tester has regular user credentials.
- Browser DevTools is available.

### Test Steps

1. Login as a regular user.
2. Create a task with description:

```html
<img src=x onerror=alert('XSS')>
```

3. Refresh Dashboard and confirm no alert executes.
4. Update Profile Bio with:

```html
<svg onload=alert(document.cookie)></svg>
```

5. Refresh Profile and confirm no alert executes.
6. Open DevTools > Application > Local Storage.
7. If a `user` object exists, change `"role":"user"` to `"role":"admin"`.
8. Navigate to `/admin`.
9. Inspect the `GET /api/admin/users` response in Network tab.

### Expected Vulnerable Result
- Browser executes XSS payloads.
- JavaScript can read an auth token from localStorage.
- Modified localStorage role grants access to admin data.

### Expected Secure Result
- XSS payloads are rendered as harmless text or sanitized.
- Auth token is not available in localStorage/sessionStorage.
- Backend returns `403 Forbidden` or equivalent for regular-user admin API access.
- LocalStorage tampering does not expose admin data.

### Actual Result
To be completed during execution.

### Status
- [ ] Pass
- [ ] Fail
- [ ] Blocked

### Evidence
Attach browser screenshots, localStorage screenshot, and Network tab response.

