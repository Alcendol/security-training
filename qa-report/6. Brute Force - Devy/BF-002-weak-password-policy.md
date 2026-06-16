# Security Vulnerability Report

**Report Date**: 2026-06-15  
**Tester Name**: Devy Relliani | dsaffiya@PMINTL.NET
**Project**: SecureTask Security Training  

---

## Vulnerability #BF-002: Weak Password Policy During Registration

### Classification
- **Severity**: [ ] Critical  [ ] High  [x] Medium  [ ] Low
- **Category**: [ ] SQL Injection  [ ] XSS  [x] Authentication  [ ] Authorization  [ ] Data Exposure  [ ] Hardcoded Secrets  [x] Other: Weak Password Requirements
- **Status**: [x] Open  [ ] In Progress  [ ] Fixed  [ ] Verified  [ ] Won't Fix
- **CVSS Score**: 6.5 estimated

### Location
- **Component**: [x] Frontend  [x] Backend  [x] API  [ ] Database
- **File Path**: `backend/handlers/auth.go`, `frontend/src/pages/Register.jsx`
- **Line Numbers**: `backend/handlers/auth.go:17-44`, `frontend/src/pages/Register.jsx:27-33,99-108`
- **Endpoint/URL**: `POST /api/auth/register`, `/register`

### Description
The registration flow requires a password field but does not enforce minimum length, complexity, or known-weak password checks. The frontend also has no password requirement guidance.

### Reproduction Steps
1. Open the Register page.
2. Submit a new account with a short password such as `123`.
3. Observe whether registration succeeds.
4. If the email already exists, use a new email address.

### Expected Behavior
The application should reject weak passwords and return a clear validation message.

### Actual Behavior
The backend only requires the password field to be present.

### Proof of Concept
```bash
curl -i -X POST "http://localhost:8080/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"weak-password-qa@example.com\",\"password\":\"123\",\"name\":\"Weak Password QA\"}"
```

**Screenshots/Evidence**:
1. Registration request with weak password succeeds.
![alt text](image-1.png)
2. Source review shows `binding:"required"` only for password.
![alt text](image-3.png)

### Impact
Weak passwords increase the likelihood of account takeover through brute force or credential guessing.

**What an attacker could do**:
- [ ] Read sensitive data
- [ ] Modify data
- [ ] Delete data
- [x] Steal user credentials
- [x] Impersonate users
- [ ] Execute arbitrary code
- [x] Other: guess weak account passwords

**Affected Users/Data**:
All accounts created with weak passwords.

### Risk Assessment
**Likelihood**: [x] High  [ ] Medium  [ ] Low  
**Impact**: [ ] High  [x] Medium  [ ] Low  

**Justification**: Weak passwords are easy to create and the login endpoint has no brute force protection.

### Recommendation
Enforce password length and quality requirements server-side, with matching frontend guidance.

**Suggested Actions**:
1. Require a reasonable minimum password length.
2. Reject common or known-compromised passwords where practical.
3. Add frontend validation hints for user experience.
4. Keep final validation on the backend.

### References
- OWASP Authentication Cheat Sheet
- NIST Digital Identity Guidelines, password guidance

### Testing Notes
Use unique test emails when retesting registration.

### Retest Results (After Fix)
**Retest Date**: Not started  
**Status**: [ ] Vulnerability Fixed  [ ] Partially Fixed  [x] Not Fixed  
**Notes**: Retest with short, common, and valid strong passwords.
