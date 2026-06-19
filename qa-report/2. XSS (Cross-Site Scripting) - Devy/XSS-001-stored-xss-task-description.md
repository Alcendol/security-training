# Security Vulnerability Report

**Report Date**: 2026-06-15  
**Tester Name**: Devy Relliani | dsaffiya@PMINTL.NET
**Project**: SecureTask Security Training  

---

## Vulnerability #XSS-001: Stored XSS in Task Description Rendering

### Classification
- **Severity**: [ ] Critical  [x] High  [ ] Medium  [ ] Low
- **Category**: [ ] SQL Injection  [x] XSS  [ ] Authentication  [ ] Authorization  [x] Data Exposure  [ ] Hardcoded Secrets  [ ] Other: _______
- **Status**: [x] Open  [ ] In Progress  [ ] Fixed  [ ] Verified  [ ] Won't Fix
- **CVSS Score**: 8.8 estimated

### Location
- **Component**: [x] Frontend  [x] Backend  [ ] API  [x] Database
- **File Path**: `frontend/src/pages/Dashboard.jsx`, `backend/handlers/tasks.go`, `backend/models/task.go`
- **Line Numbers**: `frontend/src/pages/Dashboard.jsx:196-200`, `backend/handlers/tasks.go:27-43`, `backend/models/task.go:10`
- **Endpoint/URL**: `/dashboard`, `POST /api/tasks`

### Description
Task descriptions are stored without sanitization and later rendered with `dangerouslySetInnerHTML`. This enables stored cross-site scripting when a task description contains malicious HTML with executable event handlers and can trigger a popup alert showing `XSS` when the Dashboard renders the task.

### Reproduction Steps
1. Login as a user.
2. Create a new task.
3. Set the description to `<img src=x onerror=alert('XSS')>`.
4. Save the task.
5. View the Dashboard.
6. Observe that JavaScript executes in the browser.

### Expected Behavior
User-generated task descriptions should be rendered as plain text or sanitized before being inserted into the DOM.

### Actual Behavior
The frontend inserts task descriptions as raw HTML through `dangerouslySetInnerHTML`, so the malicious payload renders and shows a popup alert with `XSS`.

### Proof of Concept
```html
<img src=x onerror=alert('XSS')>
```

**Screenshots/Evidence**:
- Browser alert or console evidence after viewing the task.
- Source review shows `dangerouslySetInnerHTML` with `task.description`.
1. Script
![alt text](<Screenshot 2026-06-16 084503.png>)
2. Popup Alert
![alt text](<Screenshot 2026-06-16 084508.png>)

### Impact
An attacker can execute JavaScript in another user's browser. Because the application stores JWTs and user data in localStorage, XSS can lead to session theft and account impersonation.

**What an attacker could do**:
- [x] Read sensitive data
- [x] Modify data
- [ ] Delete data
- [x] Steal user credentials
- [x] Impersonate users
- [x] Execute arbitrary code
- [x] Other: perform actions as the victim through the web app

**Affected Users/Data**:
Any user who views a malicious task description is affected.

### Risk Assessment
**Likelihood**: [x] High  [ ] Medium  [ ] Low  
**Impact**: [x] High  [ ] Medium  [ ] Low  

**Justification**: The payload is stored and automatically rendered. Impact is high because authentication tokens are accessible to JavaScript.

### Recommendation
Keep task descriptions rendered as safe text and validate/sanitize task input before storage. This aligns with the developer fixes that removed raw HTML rendering in the Dashboard and added backend validation/escaping for task fields.

**Suggested Actions**:
1. Render task titles and descriptions as plain text by default.
2. If rich text is ever required, sanitize it with a trusted allowlist-based sanitizer before rendering.
3. Validate task title, description, priority, and status server-side.
4. Escape or sanitize stored task text so event-handler payloads become harmless text.
5. Keep XSS regression tests for `<img onerror>`, `<svg onload>`, event handlers, and `javascript:` URLs.

### References
- OWASP Cross Site Scripting Prevention Cheat Sheet
- CWE-79: Improper Neutralization of Input During Web Page Generation
- React documentation for `dangerouslySetInnerHTML`

### Testing Notes
`<script>` tags inserted via `innerHTML` may not execute in all browsers. Event-handler payloads such as `<img onerror>` are better for verification.

### Retest Results (After Fix)
**Retest Date**: 2026-06-19  
**Status**: [x] Vulnerability Fixed [ ] Partially Fixed [ ] Not Fixed  
**Notes**: Verified on the fixed build (`:8080`): task title/description are HTML-escaped server-side (`html.EscapeString` in `CreateTask`/`UpdateTask`) and rendered as escaped text by React (no `dangerouslySetInnerHTML`). Payloads `<script>alert('XSS')</script>` and `<img src=x onerror=alert('XSS')>` are displayed as inert text and trigger no JS dialog/execution. Confirmed by automated suite `qa/automation` (feature `xss.feature`, screenshot evidence under `qa/automation/evidence/xss/`).
