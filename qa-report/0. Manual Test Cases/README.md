# SecureTask Phase 2 Manual Test Cases

**Phase**: Phase 2 - Test Case Development  
**Source**: `qa-report/` Phase 1 vulnerability reports  
**Scope**: Manual verification and retest cases for all current report findings

## How to Use

1. Start PostgreSQL, backend, and frontend.
2. Prepare test users and at least one task where required.
3. Execute each test case manually.
4. Fill in **Actual Result**, **Status**, and **Evidence**.
5. During fix verification, compare behavior against **Expected Secure Result**.

## Status Convention

- **Pass**: Secure behavior is observed.
- **Fail**: Vulnerable behavior is still observed.
- **Blocked**: Test cannot be completed because setup, data, or environment is unavailable.

## Test Case Index

| File | Report Findings Covered |
|---|---|
| `01-sql-injection-manual-test-cases.md` | `SQL-001` |
| `02-xss-manual-test-cases.md` | `XSS-001`, `XSS-002`, `XSS-003` |
| `03-authentication-authorization-manual-test-cases.md` | `AUTH-001` through `AUTH-007` |
| `04-insecure-data-storage-manual-test-cases.md` | `STORE-001` through `STORE-004` |
| `05-hardcoded-credentials-manual-test-cases.md` | `SECRET-001`, `SECRET-002` |
| `06-brute-force-manual-test-cases.md` | `BF-001`, `BF-002` |
| `07-developer-fix-verification-tests.md` | Additional regression checks from developer fix documentation |

## Environment Notes

- Default frontend URL: `http://localhost:5173`
- Default backend URL: `http://localhost:8080`
- Default regular user: `user@example.com / password123`
- Default admin user: `admin@example.com / admin123`
- Some API tests require a valid task ID. Create a task first through the UI or authenticated API.

