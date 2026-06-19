const path = require("path");

// support/ -> automation/ -> qa/ -> repo root
const repoRoot = path.resolve(__dirname, "..", "..", "..");

function normalizeApiBaseUrl(value) {
  const trimmed = value.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

module.exports = {
  repoRoot,
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, ""),
  apiBaseUrl: normalizeApiBaseUrl(
    process.env.API_BASE_URL || process.env.BACKEND_URL || "http://localhost:8080/api",
  ),

  // Seeded accounts created by backend/main.go seedData(). Used for UI flows so
  // the brute-force scenario (which locks an account) can target a throwaway
  // email instead.
  seedUser: { email: "user@example.com", password: "password123" },
  seedAdmin: { email: "admin@example.com", password: "admin123" },

  // The auth cookie name set by the backend (backend/handlers/auth.go).
  authCookieName: "auth_token",

  // Run headed for debugging with HEADED=1.
  headed: process.env.HEADED === "1",

  payloads: {
    sqlInjection: [
      "' OR '1'='1",
      "' OR 1=1--",
      "'; DROP TABLE tasks; --",
      "' UNION SELECT * FROM users--",
      "admin'--",
    ],
    xss: {
      script: "<script>alert('XSS')</script>",
      imgOnerror: "<img src=x onerror=alert('XSS')>",
    },
  },
};
