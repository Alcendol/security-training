# SecureTask Frontend — Security Fix Documentation

> **Branch**: `fix/frontend-security-remaining`
> **Tanggal**: 2026-06-08
> **Referensi**: README.md (frontend)

---

## Pemetaan Tugas vs Pengerjaan

README mendefinisikan **7 vulnerability** yang harus diperbaiki. Tabel berikut menunjukkan status keseluruhan:

| # | Vulnerability (README) | Status Sebelumnya | Sesi Ini | File Terdampak |
|---|---|---|---|---|
| 1 | XSS — `dangerouslySetInnerHTML` & unsanitized output | ✅ Sebagian (Dashboard) | ✅ Selesai (Profile bio) | Profile.jsx, Dashboard.jsx |
| 2 | Insecure Data Storage — localStorage/sessionStorage | ✅ Sebagian (token → cookie) | ✅ Selesai (data sensitif & debug) | storage.js, Login.jsx, Profile.jsx |
| 3 | Hardcoded Credentials | ❌ Belum | ✅ Selesai | config.js, Login.jsx |
| 4 | Missing Authorization | ✅ Selesai (redirect non-admin) | ✅ Cleanup | AdminPanel.jsx |
| 5 | No CSP | ❌ Belum | ✅ Selesai | index.html |
| 6 | Information Disclosure | ✅ Sebagian (console.log dev-only) | ✅ Selesai (debug UI, error msgs) | Profile.jsx, Register.jsx, AdminPanel.jsx, Dashboard.jsx, Login.jsx |
| 7 | SQL Injection | ✅ Selesai (params encoding) | ✅ Cleanup | api.js |

**Plus tambahan:**
- Password validation di Register (tidak ada sebelumnya)
- Import `getCurrentUser` yang hilang di App.jsx (bug fungsional)
- Cleanup semua stale VULNERABILITY comments & commented-out code

---

## Detail Perubahan Per File

---

### 1. `src/config.js`

**Vulnerability**: #3 Hardcoded Credentials

#### BEFORE
```js
// VULNERABILITY #4: Hardcoded API configuration and secrets
export const API_BASE_URL = 'http://localhost:8080/api';

// VULNERABILITY #4: Hardcoded API key in source code
export const ADMIN_API_KEY = 'admin-key-12345'; // Should NEVER be in frontend code!

// VULNERABILITY #4: Hardcoded credentials
export const DEFAULT_CREDENTIALS = {
  admin: { email: 'admin@example.com', password: 'admin123' },
  user:  { email: 'user@example.com', password: 'password123' }
};

// VULNERABILITY: Debug mode left enabled
export const DEBUG_MODE = true;

export const APP_CONFIG = {
  name: 'SecureTask',
  version: '1.0.0',
  // VULNERABILITY #4: AWS credentials hardcoded (even if fake)
  aws: {
    accessKey: 'AKIAIOSFODNN7EXAMPLE',
    secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    bucket: 'securetask-uploads'
  }
};
```

#### AFTER
```js
// API configuration — uses environment variable with fallback for local dev
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

export const APP_CONFIG = {
  name: "SecureTask",
  version: "1.0.0",
};
```

**Logika Perubahan:**
- `ADMIN_API_KEY` → **Dihapus total**. API key tidak boleh ada di frontend; server-side authorization yang menentukan akses.
- `DEFAULT_CREDENTIALS` → **Dihapus total**. Hardcoded credential di source code bisa langsung dibaca siapapun yang melihat kode (git history, bundle JS, dll).
- `DEBUG_MODE = true` → **Dihapus**. Flag debug aktif bisa menyebabkan informasi sensitif terekspos.
- AWS credentials → **Dihapus**. Meskipun "fake", developer lain mungkin menggantinya dengan credentials asli.
- `API_BASE_URL` → Dipindah ke env var (`import.meta.env.VITE_API_BASE_URL`) dengan fallback untuk dev.

---

### 2. `index.html`

**Vulnerability**: #5 No CSP (Content Security Policy)

#### BEFORE
```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SecureTask - Training Project</title>
</head>
```

#### AFTER
```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Content Security Policy -->
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:8080; frame-ancestors 'none'; form-action 'self';"
  />

  <!-- Prevent MIME-type sniffing -->
  <meta http-equiv="X-Content-Type-Options" content="nosniff" />

  <!-- Referrer Policy -->
  <meta name="referrer" content="strict-origin-when-cross-origin" />

  <title>SecureTask</title>
</head>
```

**Logika Perubahan — CSP Directives:**

| Directive | Fungsi |
|---|---|
| `default-src 'self'` | Semua resource hanya boleh dari origin sendiri |
| `script-src 'self'` | Inline `<script>alert()</script>` diblokir browser |
| `style-src 'self' 'unsafe-inline'` | Inline style diizinkan (diperlukan Tailwind) |
| `img-src 'self' data:` | Gambar dari self & data URI |
| `connect-src 'self' http://localhost:8080` | Fetch/XHR hanya ke origin + backend dev |
| `frame-ancestors 'none'` | Anti-clickjacking: halaman tidak bisa di-embed di iframe |
| `form-action 'self'` | Form submit hanya ke origin sendiri |

**Security headers tambahan:**
- `X-Content-Type-Options: nosniff` → Mencegah browser menebak MIME type (content-sniffing attack).
- `Referrer-Policy: strict-origin-when-cross-origin` → Tidak mengirim full URL ke domain lain via header Referer.

---

### 3. `src/utils/storage.js`

**Vulnerability**: #2 Insecure Data Storage

#### BEFORE
```js
export const setUserData = (user) => {
  // Storing full user object including password!
  localStorage.setItem('user', JSON.stringify(user));
  
  // Also storing in sessionStorage (duplikasi)
  sessionStorage.setItem('currentUser', JSON.stringify(user));
};

export const clearUserData = () => {
  localStorage.removeItem('user');
  sessionStorage.removeItem('currentUser');
  // Tidak clear all — data lain tertinggal
};

export const saveSettings = (settings) => {
  localStorage.setItem('appSettings', JSON.stringify(settings));
};

// Menyimpan debug info sensitif ke localStorage
export const saveDebugInfo = (info) => {
  localStorage.setItem('debugInfo', JSON.stringify({
    ...info,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  }));
};
```

#### AFTER
```js
// Store minimal, non-sensitive user data for UI display purposes only
export const setUserData = (user) => {
  const safeData = {
    id: user.id,
    name: user.name,
    role: user.role,
  };
  localStorage.setItem("user", JSON.stringify(safeData));
};

export const getUserData = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const clearUserData = () => {
  // Clear all stored data to prevent data leakage
  localStorage.clear();
  sessionStorage.clear();
};
```

**Logika Perubahan:**
- **`setUserData`**: Hanya simpan `{id, name, role}` — data minimum yang dibutuhkan UI. Password, token, dan field sensitif lainnya tidak disimpan.
- **Duplikasi sessionStorage**: Dihapus. Tidak ada alasan menyimpan data yang sama di dua tempat.
- **`clearUserData`**: Dari menghapus 2 key spesifik → `localStorage.clear()` + `sessionStorage.clear()`. Memastikan **semua** data terhapus saat logout.
- **`saveSettings`** & **`saveDebugInfo`**: Dihapus total. `saveDebugInfo` adalah vektor information disclosure — menyimpan userAgent, email, timestamp ke localStorage yang bisa dibaca via XSS.

---

### 4. `src/pages/Login.jsx`

**Vulnerability**: #2 Storage, #3 Hardcoded Credentials, #6 Information Disclosure

#### BEFORE
```jsx
import { setUserData, saveDebugInfo } from "../utils/storage"; // saveDebugInfo diimport

const handleSubmit = async (e) => {
  try {
    const response = await login(email, password);

    // Commented-out code yang masih ada:
    // setToken(response.data.token);     ← token localStorage
    // saveDebugInfo({ email, ... });     ← debug ke localStorage

    const user = response.data.user;
    setUserData({ id, name, email, role }); // OK
    // setUserData(response.data.user);   ← full object dengan password

    setAuth(true);
    navigate("/dashboard");
  } catch (err) {
    // Commented-out expose error detail:
    // setError(err.response?.data?.error || "Login failed");
    setError("Login failed")
  }
};

// UI — Test credentials ditampilkan!
<div className="mt-6 p-4 bg-gray-100 rounded text-sm">
  <p className="font-semibold mb-2">Test Accounts:</p>
  <p className="text-gray-700">User: user@example.com / password123</p>
  <p className="text-gray-700">Admin: admin@example.com / admin123</p>
</div>

// Warning teks di judul
<p className="text-red-600 text-sm mt-2">
  ⚠️ Training Project - Contains Vulnerabilities
</p>
```

#### AFTER
```jsx
import { setUserData } from "../utils/storage"; // Hanya yang dibutuhkan

const handleSubmit = async (e) => {
  try {
    const response = await login(email, password);

    const user = response.data.user;
    setUserData({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    setAuth(true);
    navigate("/dashboard");
  } catch (err) {
    setError("Login failed"); // Generic
  }
};

// Test credentials → DIHAPUS
// Warning teks → DIHAPUS
<div className="text-center mb-8">
  <h1 className="text-3xl font-bold text-gray-900">SecureTask</h1>
</div>
```

**Logika Perubahan:**
- **`saveDebugInfo` import** → Dihapus (fungsinya sudah tidak ada di storage.js).
- **Commented-out vulnerable code** → Semua dihapus. Dead code membingungkan dan bisa memancing developer untuk "uncomment" kode yang berbahaya.
- **Test credentials di UI** → Dihapus. Menampilkan `password123` / `admin123` di UI adalah information disclosure langsung.
- **"Contains Vulnerabilities" text** → Dihapus karena sudah tidak akurat setelah fix diterapkan.

---

### 5. `src/pages/Register.jsx`

**Vulnerability**: #6 Information Disclosure + tambahan password validation

#### BEFORE
```jsx
const handleSubmit = async (e) => {
  // Tidak ada validasi password sama sekali

  try {
    await register(formData.email, formData.password, formData.name);
  } catch (err) {
    setError(err.response?.data?.error || 'Registration failed'); // ← expose server error
    console.error('Registration error:', err);                    // ← tanpa dev check
  }
};

// Input password tanpa feedback atau validasi
<input type="password" name="password" value={formData.password} />
{/* VULNERABILITY #2: No password strength indicator or requirements */}
```

#### AFTER
```jsx
import { useState, useMemo } from 'react';

const PASSWORD_RULES = [
  { label: 'At least 8 characters',              test: (pw) => pw.length >= 8 },
  { label: 'Contains uppercase letter',          test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Contains lowercase letter',          test: (pw) => /[a-z]/.test(pw) },
  { label: 'Contains a number',                  test: (pw) => /[0-9]/.test(pw) },
  { label: 'Contains special character (!@#$%)', test: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

// Real-time evaluasi kekuatan
const passwordChecks = useMemo(
  () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(formData.password) })),
  [formData.password],
);
const isPasswordValid = passwordChecks.every((r) => r.passed);

const handleSubmit = async (e) => {
  if (!isPasswordValid) {
    setError('Password does not meet the requirements.');
    return; // Block submit
  }
  try {
    await register(formData.email, formData.password, formData.name);
  } catch (err) {
    setError('Registration failed'); // Generic
    if (process.env.NODE_ENV === "development") {
      console.error('Registration error:', err);
    }
  }
};

// Visual password strength bar + checklist
{formData.password.length > 0 && (
  <div className="mt-3">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-medium text-gray-600">Strength:</span>
      <span className={`text-xs font-semibold ${...strengthColorClass}`}>{strengthLabel}</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all duration-300 ${strengthColor}`}
        style={{ width: `${(passedCount / PASSWORD_RULES.length) * 100}%` }}
      />
    </div>
    <ul className="mt-2 space-y-1">
      {passwordChecks.map((rule, i) => (
        <li key={i} className={rule.passed ? 'text-green-600' : 'text-gray-400'}>
          {rule.passed ? '✓' : '○'} {rule.label}
        </li>
      ))}
    </ul>
  </div>
)}

// Tombol disabled sampai password valid
<button
  type="submit"
  disabled={!isPasswordValid && formData.password.length > 0}
  className="... disabled:opacity-50 disabled:cursor-not-allowed"
>
  Register
</button>
```

**Logika Perubahan:**
- **Password validation** → 5 aturan: min 8 char, uppercase, lowercase, angka, special char. Dievaluasi real-time via `useMemo`.
- **Visual strength bar** → Progress bar dinamis (Weak/Fair/Good/Strong) dengan transisi CSS.
- **Checklist per aturan** → User tahu persis aturan mana yang belum terpenuhi.
- **Submit guard** → Form tidak bisa submit sampai semua aturan pass.
- **Error message** → Dari `err.response?.data?.error` → `'Registration failed'` (generic, tidak expose detail server).

---

### 6. `src/pages/Profile.jsx`

**Vulnerability**: #1 XSS, #2 Storage, #6 Information Disclosure

#### BEFORE
```jsx
// Placeholder menyarankan XSS
<textarea placeholder="Tell us about yourself... (Try: <img src=x onerror=alert('XSS')>)" />

// Bio ditampilkan sebagai raw HTML — XSS!
<div dangerouslySetInnerHTML={{ __html: user.bio }} />

// Menyimpan full API response ke localStorage
const response = await updateProfile(user.id, formData);
setUserData(response.data); // bisa mengandung password hash, token, dll

// console.error tanpa dev check
console.error('Update error:', error);

// Debug JSON dump di UI
<div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
  <h3>Debug Info (Should be removed in production!):</h3>
  <pre>{JSON.stringify(user, null, 2)}</pre>
</div>
```

#### AFTER
```jsx
// Placeholder aman
<textarea placeholder="Tell us about yourself..." />

// Bio sebagai teks biasa — aman dari XSS
<p className="text-gray-700 whitespace-pre-wrap">{user.bio}</p>

// Hanya simpan field yang diperlukan
const updatedUser = {
  id: response.data.id,
  name: response.data.name,
  email: response.data.email,
  role: response.data.role,
  bio: response.data.bio,
};
setUserData(updatedUser);

// console.error hanya di dev
if (process.env.NODE_ENV === "development") {
  console.error('Update error:', error);
}

// Debug JSON dump → DIHAPUS TOTAL
```

**Logika Perubahan:**
- **`dangerouslySetInnerHTML`** → Diganti `<p>{user.bio}</p>`. React secara default melakukan HTML escaping di JSX — `<script>` di bio akan ditampilkan sebagai teks literal, bukan dieksekusi. `whitespace-pre-wrap` mempertahankan newline.
- **`setUserData(response.data)`** → Pilih hanya 5 field spesifik. Meskipun API mengembalikan data sensitif, field itu tidak masuk ke localStorage.
- **Debug JSON dump** → Dihapus. Menampilkan seluruh state `user` ke browser membantu attacker memetakan struktur data.

---

### 7. `src/pages/Dashboard.jsx`

**Vulnerability**: #1 XSS (placeholder), #6 Information Disclosure

#### BEFORE
```jsx
// Placeholder menyarankan SQL injection
<input placeholder="Search tasks... (Try: ' OR '1'='1)" />

// Placeholder menyarankan XSS
<textarea placeholder="Task description (Try: <script>alert('XSS')</script>)" />

// Warning bar di navbar
<h1>SecureTask</h1>
<span className="ml-4 text-sm text-red-600">⚠️ Vulnerable Training App</span>
```

#### AFTER
```jsx
<input placeholder="Search tasks..." />
<textarea placeholder="Task description" />
<h1 className="text-xl font-bold text-gray-900">SecureTask</h1>
// Tidak ada warning bar
```

**Logika Perubahan:**
- Placeholder yang menyarankan payload attack = tutorial eksploitasi. Diganti placeholder deskriptif normal.
- Vulnerability warning di navbar dihapus.

---

### 8. `src/pages/AdminPanel.jsx`

**Vulnerability**: #2 Missing Authorization, #6 Information Disclosure

#### BEFORE
```jsx
// console.error selalu tampil
} catch (err) {
  setError("Failed to load users");
  console.error("Error loading users:", err); // stack trace bocor ke console
}

// Warning box mengekspos security issues
<div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
  <h3>🚨 Security Issues on This Page:</h3>
  <ul>
    <li>No server-side authorization check - anyone can access this endpoint</li>
    <li>Passwords are visible in plain text</li>
    <li>Client-side role check can be bypassed</li>
    <li>Sensitive user data exposed without proper access control</li>
  </ul>
</div>

// Kolom Password di tabel
<th>Password</th>
```

#### AFTER
```jsx
// console.error hanya di dev
} catch (err) {
  setError("Failed to load users");
  if (process.env.NODE_ENV === "development") {
    console.error("Error loading users:", err);
  }
}

// Warning box → DIHAPUS
// Kolom Password → sudah dihapus di sesi sebelumnya, header cleanup dilakukan
```

**Logika Perubahan:**
- Security issues warning box mengekspos detail kelemahan sistem kepada user/attacker. Dihapus karena fix sudah diterapkan.
- `console.error` tanpa dev check bisa bocorkan stack trace berisi info internal (nama fungsi, path, struktur DB).

---

### 9. `src/services/api.js`

**Vulnerability**: #3 Hardcoded credentials, #6 Information Disclosure

#### BEFORE
```js
api.interceptors.request.use((config) => {
  if (process.env.NODE_ENV === "development") {
    // config.data berisi password saat login!
    console.log("API Request:", config.method, config.url, config.data);
  }
  return config;
});

api.interceptors.response.use((response) => {
  if (process.env.NODE_ENV === "development") {
    // response.data bisa berisi token, user data, password hash
    console.log("API Response:", response.data);
  }
  return response;
});

export const getAllUsers = () => {
  return api.get("/admin/users", {
    // headers: { "X-Admin-Key": ADMIN_API_KEY } // commented-out hardcoded key
  });
};
```

#### AFTER
```js
api.interceptors.request.use((config) => {
  if (process.env.NODE_ENV === "development") {
    console.log("API Request:", config.method, config.url); // Tidak ada config.data
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response; // Tidak ada console.log response body
  },
  (error) => {
    if (process.env.NODE_ENV === "development") {
      console.error("Response Error:", error.response?.status); // Hanya status code
    }
    return Promise.reject(error);
  },
);

// Admin endpoint — tanpa hardcoded key, server enforce via JWT cookie
export const getAllUsers = () => {
  return api.get("/admin/users");
};
```

**Logika Perubahan:**
- **`console.log(..., config.data)`** → `config.data` mengandung password saat login. Dihapus dari log.
- **`console.log("API Response:", response.data)`** → Bisa log JWT token, user data. Tidak di-log sama sekali di interceptor (hanya status code untuk error).
- **Commented-out `X-Admin-Key` header** → Dead code dihapus sepenuhnya.

---

### 10. `src/App.jsx`

**Bug**: Missing import — `getCurrentUser` digunakan tapi tidak di-import

#### BEFORE
```jsx
// getCurrentUser tidak ada di imports!
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
// ...

useEffect(() => {
  const checkAuth = async () => {
    try {
      await getCurrentUser(); // ← ReferenceError: getCurrentUser is not defined
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false); // Selalu catch error → user selalu dianggap tidak auth
    }
  };
  checkAuth();
}, []);
```

#### AFTER
```jsx
import AdminPanel from "./pages/AdminPanel";
import { getCurrentUser } from "./services/api"; // ← Ditambahkan

useEffect(() => {
  const checkAuth = async () => {
    try {
      await getCurrentUser(); // Sekarang terdefinisi & berfungsi
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
    }
  };
  checkAuth();
}, []);
```

**Logika Perubahan:**
- Tanpa import ini, `getCurrentUser` adalah `undefined` → melempar `TypeError: getCurrentUser is not a function` → `catch` menangkap → `setIsAuthenticated(false)` → semua authenticated routes tidak bisa diakses sama sekali (redirect ke login terus). Ini bug fungsional kritis.

---

## Ringkasan Semua Commit

```
d003d67  chore: remove stale vulnerability comments and commented-out code
3872c44  fix: add missing getCurrentUser import in App.jsx
c1b241c  fix: add client-side password strength validation on register
948f853  fix: remove information disclosure and debug data from production
d7f5049  fix: secure local storage by removing sensitive data and debug info
e0aa249  fix: add Content Security Policy and clickjacking protection
f2b869b  fix: remove hardcoded credentials and secrets from source code
921c1b6  fix: sanitize XSS in profile bio and remove vulnerable placeholders
```

---

## Hasil Verifikasi

### Build Check
```
$ npm run build
vite v5.4.21 building for production...
✓ 93 modules transformed.
dist/index.html                   0.96 kB │ gzip:  0.51 kB
dist/assets/index-CFKgnoKs.css   13.47 kB │ gzip:  3.22 kB
dist/assets/index-CcHoioB9.js   223.33 kB │ gzip: 73.19 kB
✓ built in 527ms
```
**Status: ✅ PASS**

### Grep Security Checks

| Pemeriksaan | Hasil |
|---|---|
| Tidak ada `dangerouslySetInnerHTML` di src/ | ✅ Zero matches |
| Tidak ada hardcoded credentials | ✅ Zero matches |
| Tidak ada stale VULNERABILITY comments | ✅ Zero matches |
| CSP meta tag ada di index.html | ✅ Terkonfirmasi |

---

## Checklist vs README "What Should Be Fixed?"

| Item di README | Status |
|---|---|
| Use DOMPurify for HTML sanitization | ✅ Tidak pakai `dangerouslySetInnerHTML` sama sekali — pendekatan lebih aman dari DOMPurify |
| Store tokens in httpOnly cookies | ✅ Fix sesi sebelumnya (backend set cookie, frontend `withCredentials: true`) |
| Remove hardcoded credentials | ✅ Fix sesi ini (config.js bersih, test creds UI dihapus) |
| Implement proper CSP headers | ✅ Fix sesi ini (meta CSP + frame-ancestors + referrer policy) |
| Add server-side authorization checks | ⚠️ Frontend redirect non-admin sudah ada; server enforcement ada di backend (di luar scope frontend) |
| Never store passwords in frontend | ✅ `setUserData` hanya simpan `{id, name, role}` |
| Validate and sanitize all inputs | ✅ Password validation di Register; search di-trim & dibatasi 100 char |
| Remove debug information from production | ✅ Debug JSON UI, console.error tanpa dev check, warning text — semua dihapus |
