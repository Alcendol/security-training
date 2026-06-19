const assert = require("node:assert/strict");
const { When, Then } = require("@cucumber/cucumber");

When("I request the admin users endpoint", async function () {
  const ctx = this.userCtx("me");
  const response = await ctx.get(this.apiUrl("/admin/users"));
  await this.setLast(response);
});

When(
  "{string} tries to update the profile of {string} with name {string}",
  async function (attackerAlias, victimAlias, newName) {
    const ctx = this.userCtx(attackerAlias);
    const victim = this.users[victimAlias].user;
    const response = await ctx.put(this.apiUrl(`/users/${victim.id}/profile`), {
      data: { name: newName },
    });
    await this.setLast(response);
  },
);

When(
  "I update my own profile with name {string} and role {string}",
  async function (name, role) {
    const ctx = this.userCtx("me");
    const me = this.users.me.user;
    const response = await ctx.put(this.apiUrl(`/users/${me.id}/profile`), {
      data: { name, role, password: "tampered123" },
    });
    await this.setLast(response);
  },
);

Then("my role should still be {string}", async function (expectedRole) {
  const ctx = this.userCtx("me");
  const response = await ctx.get(this.apiUrl("/users/me"));
  assert.equal(response.status(), 200, `/users/me -> ${response.status()}`);
  const me = await response.json();
  assert.equal(
    me.role,
    expectedRole,
    `role was escalated to "${me.role}" via mass assignment`,
  );
});

// --- Client-side role bypass (browser) -------------------------------------

When("I tamper with the stored user role to {string}", async function (role) {
  await this.page.evaluate((newRole) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.role = newRole;
    localStorage.setItem("user", JSON.stringify(user));
  }, role);
});

When("I reach the admin panel through the tampered link", async function () {
  const page = this.page;
  // Reload so the dashboard re-reads the tampered role and shows the admin link,
  // then navigate via the SPA link (keeps the authenticated session in memory).
  await page.reload();
  await page.waitForURL("**/dashboard");
  await page.getByRole("link", { name: "Admin Panel" }).click();
  await page.waitForURL("**/admin");
});

Then("I should not see any admin user data", async function () {
  const page = this.page;
  // The server returns 403 to non-admins, so the panel surfaces an error and
  // renders no rows — the seeded admin's email must never appear.
  await page.getByText("Failed to load users").waitFor({ state: "visible" });
  const rowCount = await page.locator("tbody tr").count();
  assert.equal(rowCount, 0, `admin data leaked: ${rowCount} user rows rendered`);
  assert.ok(
    !(await page.content()).includes(this.config.seedAdmin.email),
    "admin user data was exposed to a tampered regular user",
  );
});
