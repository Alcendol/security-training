# SecureTask QA Phase 1 Vulnerability Reports

**Report Date**: 2026-06-15  
**Phase**: Phase 1 - Discovery & Documentation  
**Scope**: `training/` backend, frontend, guidelines, and QA materials  

## Report Index

### SQL Injection
- `SQL Injection/SQL-001-search-endpoint-sql-injection.md`

### Authentication & Authorization
- `Authentication & Authorization/AUTH-001-public-task-search-data-exposure.md`
- `Authentication & Authorization/AUTH-002-public-delete-task.md`
- `Authentication & Authorization/AUTH-003-public-profile-update-horizontal-privilege-escalation.md`
- `Authentication & Authorization/AUTH-004-public-admin-users-endpoint.md`
- `Authentication & Authorization/AUTH-005-client-side-admin-authorization-bypass.md`
- `Authentication & Authorization/AUTH-006-mass-assignment-and-missing-input-validation.md`
- `Authentication & Authorization/AUTH-007-permissive-cors-policy.md`

### XSS (Cross-Site Scripting)
- `XSS (Cross-Site Scripting)/XSS-001-stored-xss-task-description.md`
- `XSS (Cross-Site Scripting)/XSS-002-stored-xss-profile-bio.md`
- `XSS (Cross-Site Scripting)/XSS-003-missing-content-security-policy.md`

### Insecure Data Storage
- `Insecure Data Storage/STORE-001-plaintext-password-storage-and-api-exposure.md`
- `Insecure Data Storage/STORE-002-jwt-token-in-localstorage.md`
- `Insecure Data Storage/STORE-003-sensitive-user-data-in-browser-storage-and-debug-ui.md`
- `Insecure Data Storage/STORE-004-sensitive-api-data-logged-to-console.md`

### Hardcoded Credentials
- `Hardcoded Credentials/SECRET-001-backend-hardcoded-database-jwt-and-admin-secrets.md`
- `Hardcoded Credentials/SECRET-002-frontend-hardcoded-api-keys-default-and-cloud-credentials.md`

### Brute Force
- `Brute Force/BF-001-login-endpoint-no-rate-limiting.md`
- `Brute Force/BF-002-weak-password-policy.md`

## Phase 1 Status

These reports document discovery findings, reproduction steps, severity, impact, and recommended fix direction. Retest sections are intentionally left as "Not started" until Phase 3/Phase 4 fixes are available.
