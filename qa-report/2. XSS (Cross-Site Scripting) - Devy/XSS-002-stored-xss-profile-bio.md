# Security Vulnerability Report

**Report Date**: 2026-06-15  
**Tester Name**: Devy Relliani | dsaffiya@PMINTL.NET
**Project**: SecureTask Security Training  

---

## Vulnerability #XSS-002: Stored XSS in Profile Bio Rendering

### Classification
- **Severity**: [ ] Critical  [x] High  [ ] Medium  [ ] Low
- **Category**: [ ] SQL Injection  [x] XSS  [ ] Authentication  [ ] Authorization  [x] Data Exposure  [ ] Hardcoded Secrets  [ ] Other: _______
- **Status**: [x] Open  [ ] In Progress  [ ] Fixed  [ ] Verified  [ ] Won't Fix
- **CVSS Score**: 8.8 estimated

### Location
- **Component**: [x] Frontend  [x] Backend  [x] API  [x] Database
- **File Path**: `frontend/src/pages/Profile.jsx`, `backend/handlers/users.go`, `backend/models/user.go`
- **Line Numbers**: `frontend/src/pages/Profile.jsx:113-137`, `backend/handlers/users.go:24-48`, `backend/models/user.go:13`
- **Endpoint/URL**: `/profile`, `PUT /api/users/:id/profile`

### Description
The user bio field is stored without sanitization and displayed using `dangerouslySetInnerHTML`. The profile update endpoint is also unauthenticated, so an attacker can plant a malicious bio in another user's profile.

### Reproduction Steps
1. Login to the application.
2. Navigate to Profile.
3. Update the Bio field with `<img src=x onerror=alert(document.cookie)>`.
4. Save the profile.
5. Refresh or revisit the Profile page.
6. Observe JavaScript execution.

### Expected Behavior
The bio should be displayed as safe text or sanitized HTML. JavaScript should not execute.

### Actual Behavior
The bio is inserted into the DOM as raw HTML and can execute browser-side code.

### Proof of Concept
```html
<img src=x onerror=alert(document.cookie)>
```

**Screenshots/Evidence**:
- Browser alert after profile bio renders.
- Source review shows `dangerouslySetInnerHTML` with `user.bio`.
1. ![alt text](image.png)

### Impact
An attacker can store JavaScript in profile data. Combined with token storage in localStorage, this can be used to steal tokens or perform actions as the victim.

**What an attacker could do**:
- [x] Read sensitive data
- [x] Modify data
- [ ] Delete data
- [x] Steal user credentials
- [x] Impersonate users
- [x] Execute arbitrary code
- [x] Other: persist malicious content in user profiles

**Affected Users/Data**:
Any user viewing a malicious profile bio. Because profile update is not protected, all profiles can be targeted.

### Risk Assessment
**Likelihood**: [x] High  [ ] Medium  [ ] Low  
**Impact**: [x] High  [ ] Medium  [ ] Low  

**Justification**: The vulnerable field is stored and rendered unsafely. The profile update endpoint further increases exploitability.

<!-- ### Recommendation
Render profile bios as plain text or sanitize before rendering. Protect profile updates with authentication and ownership checks.

**Suggested Actions**:
1. Remove raw HTML rendering for bio content.
2. Sanitize any allowed HTML with a trusted sanitizer.
3. Validate bio length and allowed content server-side.
4. Require authentication and ownership checks for profile updates. -->

### References
- OWASP Cross Site Scripting Prevention Cheat Sheet
- CWE-79: Cross-Site Scripting

### Testing Notes
Retest after fixing both frontend rendering and backend profile update authorization.

### Retest Results (After Fix)
**Retest Date**: Not started  
**Status**: [ ] Vulnerability Fixed  [ ] Partially Fixed  [x] Not Fixed  
**Notes**: Retest with `<img onerror>`, `<svg onload>`, and `javascript:` link payloads.
