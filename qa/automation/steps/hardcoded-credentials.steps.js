const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { When, Then } = require("@cucumber/cucumber");

// Only inspect files under version control. A gitignored local backend/.env
// legitimately holds dev secrets — the vulnerability is committing secrets, so
// the scan must mirror exactly what is tracked in the repository.
function trackedFiles(repoRoot, relPrefixMatch) {
  const out = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  return out
    .split("\n")
    .filter(Boolean)
    .filter(relPrefixMatch)
    .map((rel) => ({ rel, abs: path.join(repoRoot, rel) }));
}

function findMatches(files, pattern) {
  const matches = [];
  for (const { rel, abs } of files) {
    if (!fs.existsSync(abs)) continue;
    const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        matches.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  return matches;
}

When(
  "I scan the frontend source for hardcoded secret patterns",
  function () {
    const files = trackedFiles(
      this.config.repoRoot,
      (rel) => rel.startsWith("frontend/src/") && /\.(js|jsx|ts|tsx)$/.test(rel),
    );
    this.state.secretMatches = findMatches(
      files,
      /ADMIN_API_KEY|DEFAULT_CREDENTIALS|admin-key|AKIA|secretKey|DEBUG_MODE|password123|admin123/,
    );
  },
);

When(
  "I scan the backend and config files for hardcoded secret patterns",
  function () {
    const files = trackedFiles(
      this.config.repoRoot,
      (rel) =>
        ((rel.startsWith("backend/") && (rel.endsWith(".go") || rel.endsWith(".env"))) ||
          rel === "docker-compose.yml" ||
          rel === ".gitignore"),
    );
    this.state.secretMatches = findMatches(
      files,
      /supersecret123|admin-key-12345|AKIA[0-9A-Z]{12,}|DB_CONNECTION=|JWT_SECRET=.+[A-Za-z0-9]|DB_PASSWORD=.+|POSTGRES_PASSWORD:\s*(?!\$\{)[^\s$][^\n]*|taskpass123/,
    );
  },
);

Then("no hardcoded secrets should be found", function () {
  const matches = this.state.secretMatches || [];
  assert.equal(
    matches.length,
    0,
    `hardcoded secrets detected:\n${matches.join("\n")}`,
  );
});

Then("the backend should read the JWT secret from the environment", function () {
  const auth = fs.readFileSync(
    path.join(this.config.repoRoot, "backend", "handlers", "auth.go"),
    "utf8",
  );
  assert.ok(
    /os\.Getenv\("JWT_SECRET"\)/.test(auth),
    "backend does not read JWT_SECRET from the environment",
  );
});

Then("the .env.example template should not contain real secret values", function () {
  const file = path.join(this.config.repoRoot, "backend", ".env.example");
  assert.ok(fs.existsSync(file), "backend/.env.example not found");
  const offending = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => /^(JWT_SECRET|DB_PASSWORD|DB_USER)=.+\S/.test(line));
  assert.equal(
    offending.length,
    0,
    `.env.example contains real values:\n${offending.join("\n")}`,
  );
});

Then("the .env file should be excluded from version control", function () {
  const gitignore = fs.readFileSync(
    path.join(this.config.repoRoot, ".gitignore"),
    "utf8",
  );
  assert.ok(/(^|\/)\.env/m.test(gitignore), ".env is not listed in .gitignore");
});
