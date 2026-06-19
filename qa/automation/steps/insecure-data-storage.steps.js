const assert = require("node:assert/strict");
const { Then } = require("@cucumber/cucumber");

// Matches a JWT: three base64url segments separated by dots.
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

async function dumpStorage(page, which) {
  return page.evaluate((store) => {
    const target = store === "local" ? localStorage : sessionStorage;
    const out = {};
    for (let i = 0; i < target.length; i += 1) {
      const key = target.key(i);
      out[key] = target.getItem(key);
    }
    return out;
  }, which);
}

Then("localStorage should not contain a JWT token", async function () {
  const store = await dumpStorage(this.page, "local");
  for (const [key, value] of Object.entries(store)) {
    assert.ok(!/token|jwt/i.test(key), `localStorage has a token-like key "${key}"`);
    assert.ok(!JWT_RE.test(value || ""), `localStorage "${key}" holds a JWT: ${value}`);
  }
});

Then("sessionStorage should not contain a JWT token", async function () {
  const store = await dumpStorage(this.page, "session");
  for (const [key, value] of Object.entries(store)) {
    assert.ok(!/token|jwt/i.test(key), `sessionStorage has a token-like key "${key}"`);
    assert.ok(!JWT_RE.test(value || ""), `sessionStorage "${key}" holds a JWT: ${value}`);
  }
});

Then("web storage should not contain any password", async function () {
  const local = await dumpStorage(this.page, "local");
  const session = await dumpStorage(this.page, "session");
  const blob = JSON.stringify({ local, session });
  assert.ok(
    !/password/i.test(blob),
    `web storage contains a password reference: ${blob}`,
  );
});

Then(
  "the stored user object should only contain id, name and role",
  async function () {
    const raw = await this.page.evaluate(() => localStorage.getItem("user"));
    assert.ok(raw, 'no "user" object found in localStorage');
    const user = JSON.parse(raw);
    const keys = Object.keys(user).sort();
    assert.deepEqual(
      keys,
      ["id", "name", "role"],
      `stored user exposes unexpected fields: ${keys.join(", ")}`,
    );
  },
);

Then("the login response body should not contain a token", function () {
  const body = this.lastBody || "";
  assert.ok(
    !/"token"\s*:/.test(body) && !JWT_RE.test(body),
    `login response body leaked a token: ${body}`,
  );
});

Then("the auth cookie should be HttpOnly", async function () {
  const ctx = this.userCtx("me");
  const { cookies } = await ctx.storageState();
  const authCookie = cookies.find((c) => c.name === this.config.authCookieName);
  assert.ok(authCookie, `no "${this.config.authCookieName}" cookie was set`);
  assert.ok(authCookie.httpOnly, "auth cookie is not HttpOnly");
});
