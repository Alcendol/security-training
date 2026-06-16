#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptDir, "..", "..");

const apiBaseUrl = normalizeApiBaseUrl(
  process.env.API_BASE_URL || process.env.BACKEND_URL || "http://localhost:8080/api",
);
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const skipBruteForce = process.env.SKIP_BRUTE_FORCE === "1";
const staticOnly = process.env.STATIC_ONLY === "1";
const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const results = [];

function normalizeApiBaseUrl(value) {
  const trimmed = value.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function repoPath(...parts) {
  return path.join(repoRoot, ...parts);
}

function readText(...parts) {
  return fs.readFileSync(repoPath(...parts), "utf8");
}

function exists(...parts) {
  return fs.existsSync(repoPath(...parts));
}

function walkFiles(startDir, predicate = () => true) {
  const root = repoPath(startDir);
  if (!fs.existsSync(root)) return [];

  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", "build", ".git"].includes(entry.name)) {
          stack.push(full);
        }
      } else if (predicate(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

function findPattern(files, pattern) {
  const matches = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push(`${relative(file)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return matches;
}

function addResult(id, name, status, details = "") {
  results.push({ id, name, status, details });
}

async function runTest(id, name, fn) {
  try {
    const output = await fn();
    if (typeof output === "string") {
      addResult(id, name, "PASS", output);
      return;
    }
    addResult(id, name, output.status, output.details || "");
  } catch (error) {
    addResult(id, name, "FAIL", error.message);
  }
}

function pass(details = "") {
  return { status: "PASS", details };
}

function fail(details) {
  return { status: "FAIL", details };
}

function skip(details) {
  return { status: "SKIP", details };
}

function assertNoPassword(value, context) {
  const json = JSON.stringify(value ?? {});
  if (/"password"\s*:/.test(json)) {
    throw new Error(`${context} contains a password field`);
  }
}

function headerValue(headers, name) {
  return headers.get(name) || "";
}

async function request(method, endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.origin) {
    headers.Origin = options.origin;
  }
  if (options.session?.cookie) {
    headers.Cookie = options.session.cookie;
  }
  if (options.session?.token) {
    headers.Authorization = `Bearer ${options.session.token}`;
  }

  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs || 5000),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    text,
    data,
  };
}

function updateSessionFromResponse(session, response) {
  const setCookie = headerValue(response.headers, "set-cookie");
  if (setCookie) {
    const cookiePairs = setCookie
      .split(/,(?=\s*[^;,]+=)/)
      .map((cookie) => cookie.split(";")[0].trim())
      .filter(Boolean);
    if (cookiePairs.length > 0) {
      session.cookie = cookiePairs.join("; ");
    }
  }

  if (response.data?.token) {
    session.token = response.data.token;
  }
}

async function registerUser(email, password, name) {
  return request("POST", "/auth/register", {
    body: { email, password, name },
  });
}

async function loginUser(email, password) {
  const session = {};
  const response = await request("POST", "/auth/login", {
    body: { email, password },
    session,
  });
  updateSessionFromResponse(session, response);
  return { response, session };
}

async function createUserSession(label) {
  const email = `qa-auto-${label}-${runId}@example.com`;
  const password = "StrongPass123!";
  const register = await registerUser(email, password, `QA Auto ${label}`);
  if (![200, 201, 409].includes(register.status)) {
    throw new Error(`registration for ${label} returned ${register.status}: ${register.text}`);
  }

  const { response, session } = await loginUser(email, password);
  if (response.status !== 200) {
    throw new Error(`login for ${label} returned ${response.status}: ${response.text}`);
  }
  const user = response.data?.user;
  if (!user?.id) {
    throw new Error(`login for ${label} did not return a user id`);
  }
  return { email, password, user, session, loginResponse: response };
}

async function createTask(session, title, description = "QA auto task") {
  const response = await request("POST", "/tasks", {
    session,
    body: { title, description, priority: "medium" },
  });
  if (![200, 201].includes(response.status)) {
    throw new Error(`create task returned ${response.status}: ${response.text}`);
  }
  return response.data;
}

async function apiAvailable() {
  try {
    const response = await request("GET", "/users/me", { timeoutMs: 2500 });
    return response.status > 0;
  } catch {
    return false;
  }
}

function sourceFiles() {
  return [
    ...walkFiles("backend", (file) => file.endsWith(".go") || file.endsWith(".env")),
    ...walkFiles("frontend/src", (file) => /\.(js|jsx|ts|tsx)$/.test(file)),
    repoPath("frontend", "index.html"),
    repoPath("docker-compose.yml"),
    repoPath(".gitignore"),
  ].filter((file) => fs.existsSync(file));
}

async function runStaticTests() {
  await runTest("STATIC-SQL-001", "Search code avoids raw SQL interpolation", () => {
    const tasks = readText("backend", "handlers", "tasks.go");
    const unsafe = /fmt\.Sprintf|ExecuteRawSQL|SELECT\s+\*\s+FROM\s+tasks/i.test(tasks);
    const parameterized = /Where\("user_id = \? AND \(title ILIKE \? OR description ILIKE \?\)"/.test(tasks);
    if (unsafe) return fail("tasks.go still contains raw SQL construction or ExecuteRawSQL usage");
    if (!parameterized) return fail("SearchTasks does not show the expected parameterized GORM query");
    return pass("SearchTasks uses user-scoped parameterized query shape");
  });

  await runTest("STATIC-XSS-001", "Frontend avoids dangerouslySetInnerHTML", () => {
    const matches = findPattern(
      walkFiles("frontend/src", (file) => /\.(js|jsx|ts|tsx)$/.test(file)),
      /dangerouslySetInnerHTML/,
    );
    return matches.length === 0
      ? pass("No dangerouslySetInnerHTML usage found in frontend/src")
      : fail(matches.join("\n"));
  });

  await runTest("STATIC-XSS-003", "Frontend defines a Content Security Policy", () => {
    if (!exists("frontend", "index.html")) return fail("frontend/index.html not found");
    const html = readText("frontend", "index.html");
    return /Content-Security-Policy/.test(html) && /script-src/.test(html)
      ? pass("CSP meta tag found")
      : fail("CSP meta tag or script-src directive is missing");
  });

  await runTest("STATIC-AUTH-007", "Backend CORS is not AllowAllOrigins", () => {
    const main = readText("backend", "main.go");
    if (/AllowAllOrigins\s*:\s*true/.test(main)) {
      return fail("backend/main.go enables AllowAllOrigins");
    }
    if (!/AllowOrigins/.test(main)) {
      return fail("backend/main.go does not define explicit allowed origins");
    }
    return pass("CORS uses explicit origins");
  });

  await runTest("STATIC-STORE-001", "User passwords are excluded and bcrypt is used", () => {
    const userModel = readText("backend", "models", "user.go");
    const auth = readText("backend", "handlers", "auth.go");
    if (!/Password\s+string\s+`json:"-"/.test(userModel)) {
      return fail("User.Password is not excluded from JSON");
    }
    if (!/GenerateFromPassword|CompareHashAndPassword/.test(auth)) {
      return fail("bcrypt password hashing or comparison was not found");
    }
    return pass("Password JSON exclusion and bcrypt usage found");
  });

  await runTest("STATIC-STORE-002", "Frontend does not store JWT tokens in web storage", () => {
    const files = walkFiles("frontend/src", (file) => /\.(js|jsx|ts|tsx)$/.test(file));
    const matches = findPattern(
      files,
      /localStorage\.setItem\(["'](?:token|authToken|jwt)["']|sessionStorage\.setItem\(["'](?:token|authToken|jwt)["']/,
    );
    return matches.length === 0
      ? pass("No token writes to localStorage/sessionStorage found")
      : fail(matches.join("\n"));
  });

  await runTest("STATIC-STORE-004", "Frontend does not log sensitive API bodies", () => {
    const api = exists("frontend", "src", "services", "api.js")
      ? readText("frontend", "src", "services", "api.js")
      : "";
    const risky = /console\.log\([^)]*(config\.data|response\.data)|console\.error\([^)]*response\?\.data/.test(api);
    return risky
      ? fail("api.js logs request or response bodies")
      : pass("No sensitive interceptor body logging found");
  });

  await runTest("STATIC-SECRET-001", "Backend secrets are not hardcoded in tracked config", () => {
    const matches = findPattern(
      sourceFiles(),
      /supersecret123|admin-key-12345|AKIA[0-9A-Z]{12,}|DB_CONNECTION=|JWT_SECRET=.+[A-Za-z0-9]|DB_PASSWORD=.+|POSTGRES_PASSWORD:\s*.+|taskpass123/,
    );
    return matches.length === 0
      ? pass("No known backend secret patterns found")
      : fail(matches.slice(0, 12).join("\n"));
  });

  await runTest("STATIC-SECRET-002", "Frontend source does not expose credentials or cloud-like secrets", () => {
    const matches = findPattern(
      walkFiles("frontend/src", (file) => /\.(js|jsx|ts|tsx)$/.test(file)),
      /ADMIN_API_KEY|DEFAULT_CREDENTIALS|admin-key|AKIA|secretKey|DEBUG_MODE|password123|admin123/,
    );
    return matches.length === 0
      ? pass("No frontend hardcoded credential patterns found")
      : fail(matches.join("\n"));
  });

  await runTest("STATIC-BF-002", "Registration has server-side password requirements", () => {
    const auth = readText("backend", "handlers", "auth.go");
    if (!/binding:"required,min=8/.test(auth)) {
      return fail("password binding does not enforce minimum length");
    }
    if (!/isStrongPassword/.test(auth)) {
      return fail("server-side password strength check not found");
    }
    return pass("Server-side password length and strength checks found");
  });
}

async function runApiTests() {
  const available = await apiAvailable();
  if (!available) {
    addResult("API-ENV", "Backend availability", "SKIP", `Backend not reachable at ${apiBaseUrl}`);
    return;
  }
  addResult("API-ENV", "Backend availability", "PASS", `Backend reachable at ${apiBaseUrl}`);

  let userA;
  let userB;

  await runTest("API-SETUP", "Create isolated QA users", async () => {
    userA = await createUserSession("a");
    userB = await createUserSession("b");
    assertNoPassword(userA.loginResponse.data, "login response for user A");
    return pass(`Created users ${userA.email} and ${userB.email}`);
  });

  if (!userA || !userB) {
    addResult("API-SUITE", "Runtime API checks", "SKIP", "User setup failed");
    return;
  }

  await runTest("API-STORE-002", "Login sets httpOnly auth cookie and no token body", async () => {
    const setCookie = headerValue(userA.loginResponse.headers, "set-cookie");
    if (userA.loginResponse.data?.token) {
      return fail("login response still includes a token body");
    }
    if (!/HttpOnly/i.test(setCookie)) {
      return fail("login response does not set an HttpOnly cookie");
    }
    if (!/SameSite/i.test(setCookie)) {
      return fail("login cookie does not declare SameSite");
    }
    return pass("Login uses HttpOnly cookie without token body");
  });

  await runTest("API-STORE-001", "Auth API responses do not expose passwords", async () => {
    const registerResponse = await registerUser(
      `qa-store-${runId}@example.com`,
      "StrongPass123!",
      "QA Store",
    );
    if (![200, 201].includes(registerResponse.status)) {
      return fail(`registration returned ${registerResponse.status}: ${registerResponse.text}`);
    }
    assertNoPassword(registerResponse.data, "register response");

    const me = await request("GET", "/users/me", { session: userA.session });
    if (me.status !== 200) return fail(`/users/me returned ${me.status}`);
    assertNoPassword(me.data, "/users/me response");
    return pass("Register and current-user responses hide password fields");
  });

  await runTest("API-AUTH-001", "Task search rejects anonymous requests", async () => {
    const response = await request("GET", "/tasks/search?q=test");
    return response.status === 401
      ? pass("Anonymous search returned 401")
      : fail(`Anonymous search returned ${response.status}`);
  });

  await runTest("API-AUTH-002", "Task delete rejects anonymous requests", async () => {
    const response = await request("DELETE", "/tasks/999999");
    return response.status === 401
      ? pass("Anonymous delete returned 401")
      : fail(`Anonymous delete returned ${response.status}`);
  });

  await runTest("API-AUTH-003", "Profile update rejects anonymous and cross-user requests", async () => {
    const anonymous = await request("PUT", `/users/${userB.user.id}/profile`, {
      body: { name: "Anonymous Update" },
    });
    if (anonymous.status !== 401) {
      return fail(`anonymous profile update returned ${anonymous.status}`);
    }

    const crossUser = await request("PUT", `/users/${userB.user.id}/profile`, {
      session: userA.session,
      body: { name: "Cross User Update" },
    });
    if (crossUser.status !== 403) {
      return fail(`cross-user profile update returned ${crossUser.status}`);
    }
    return pass("Anonymous and cross-user profile updates are rejected");
  });

  await runTest("API-AUTH-004", "Admin users endpoint rejects anonymous and regular users", async () => {
    const anonymous = await request("GET", "/admin/users");
    if (anonymous.status !== 401) {
      return fail(`anonymous admin users request returned ${anonymous.status}`);
    }
    const regular = await request("GET", "/admin/users", { session: userA.session });
    if (regular.status !== 403) {
      return fail(`regular user admin users request returned ${regular.status}`);
    }
    return pass("Admin endpoint rejects anonymous and regular users");
  });

  await runTest("API-AUTH-006", "Profile update rejects mass assignment", async () => {
    const update = await request("PUT", `/users/${userA.user.id}/profile`, {
      session: userA.session,
      body: { name: "Mass Assignment QA", role: "admin", password: "newpass123" },
    });
    if (update.status !== 200) {
      return fail(`own profile update returned ${update.status}: ${update.text}`);
    }
    const me = await request("GET", "/users/me", { session: userA.session });
    if (me.data?.role === "admin") {
      return fail("role was changed to admin through profile update");
    }
    assertNoPassword(me.data, "/users/me after mass assignment");
    return pass("Protected fields were not updated through profile endpoint");
  });

  await runTest("API-SQL-001", "Task search SQL injection payload returns no unrelated tasks", async () => {
    const task = await createTask(userA.session, `QA SQL Baseline ${runId}`, "normal search text");
    const response = await request("GET", "/tasks/search?q=%27%20OR%20%271%27%3D%271", {
      session: userA.session,
    });
    if (response.status !== 200) {
      return fail(`search returned ${response.status}: ${response.text}`);
    }
    const rows = Array.isArray(response.data) ? response.data : [];
    const leakedBaseline = rows.some((row) => row.id === task.id || row.title === task.title);
    if (leakedBaseline) {
      return fail("injection payload returned unrelated baseline task");
    }
    if (/SQL|syntax|database|pq:/i.test(response.text)) {
      return fail("search response exposed database error text");
    }
    return pass("Injection payload did not return unrelated task or SQL errors");
  });

  await runTest("API-XSS-001", "Task description XSS payload is escaped or sanitized", async () => {
    const payload = `<img src=x onerror=alert('XSS-${runId}')>`;
    const task = await createTask(userA.session, `QA XSS ${runId}`, payload);
    const responseText = JSON.stringify(task);
    return /<img|onerror|<script/i.test(responseText)
      ? fail("task response contains raw executable HTML")
      : pass("task response does not contain raw executable HTML");
  });

  await runTest("API-XSS-002", "Profile bio XSS payload is escaped or sanitized", async () => {
    const payload = `<img src=x onerror=alert(document.cookie)>`;
    const response = await request("PUT", `/users/${userA.user.id}/profile`, {
      session: userA.session,
      body: { bio: payload },
    });
    if (response.status !== 200) {
      return fail(`profile update returned ${response.status}: ${response.text}`);
    }
    const responseText = JSON.stringify(response.data);
    return /<img|onerror|<script/i.test(responseText)
      ? fail("profile response contains raw executable HTML")
      : pass("profile response does not contain raw executable HTML");
  });

  await runTest("API-AUTH-007", "CORS rejects untrusted origins", async () => {
    const response = await request("GET", "/users/me", {
      origin: "http://attacker.example",
    });
    const allowOrigin = headerValue(response.headers, "access-control-allow-origin");
    if (allowOrigin === "*" || allowOrigin === "http://attacker.example") {
      return fail(`untrusted origin was allowed: ${allowOrigin}`);
    }
    return pass("Untrusted origin did not receive permissive CORS header");
  });

  await runTest("API-BF-002", "Weak registration password is rejected", async () => {
    const response = await registerUser(`qa-weak-${runId}@example.com`, "123", "Weak QA");
    return response.status === 400
      ? pass("Weak password returned 400")
      : fail(`weak password registration returned ${response.status}`);
  });

  if (skipBruteForce) {
    addResult("API-BF-001", "Login throttles repeated failures", "SKIP", "SKIP_BRUTE_FORCE=1");
  } else {
    await runTest("API-BF-001", "Login throttles repeated failures", async () => {
      const statuses = [];
      for (let i = 0; i < 20; i += 1) {
        const response = await request("POST", "/auth/login", {
          body: { email: userA.email, password: `wrong-password-${i}` },
          timeoutMs: 5000,
        });
        statuses.push(response.status);
      }
      const throttled = statuses.some((status) => [423, 429].includes(status));
      return throttled
        ? pass(`throttling observed: ${statuses.join(", ")}`)
        : fail(`no throttling observed: ${statuses.join(", ")}`);
    });
  }
}

function printSummary() {
  const order = { FAIL: 0, PASS: 1, SKIP: 2 };
  const sorted = [...results].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.id.localeCompare(b.id);
  });

  console.log("");
  console.log("SecureTask Automated Security Test Results");
  console.log(`API base URL: ${apiBaseUrl}`);
  console.log(`Frontend URL: ${frontendUrl}`);
  console.log("");

  for (const result of sorted) {
    const firstLine = `${result.status.padEnd(4)} ${result.id.padEnd(17)} ${result.name}`;
    console.log(firstLine);
    if (result.details) {
      for (const line of result.details.split("\n")) {
        console.log(`     ${line}`);
      }
    }
  }

  const counts = results.reduce(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    { PASS: 0, FAIL: 0, SKIP: 0 },
  );

  console.log("");
  console.log(`Summary: ${counts.PASS} pass, ${counts.FAIL} fail, ${counts.SKIP} skip`);
  if (counts.FAIL > 0) {
    process.exitCode = 1;
  }
}

await runStaticTests();
if (staticOnly) {
  addResult("API-SUITE", "Runtime API checks", "SKIP", "STATIC_ONLY=1");
} else {
  await runApiTests();
}
printSummary();
