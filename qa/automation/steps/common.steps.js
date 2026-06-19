const assert = require("node:assert/strict");
const { Given, When, Then } = require("@cucumber/cucumber");

// --- Shared session setup ---------------------------------------------------

Given("I am logged in to the API as a fresh user", async function () {
  await this.registerFreshUser("me");
});

Given("a fresh user {string} is logged in to the API", async function (alias) {
  await this.registerFreshUser(alias);
});

Given("I am logged in to the dashboard as the seed user", async function () {
  await this.loginViaUi(this.config.seedUser.email, this.config.seedUser.password);
});

// --- Shared API actions -----------------------------------------------------

When(
  "I send an unauthenticated {string} request to {string}",
  async function (method, endpoint) {
    const ctx = await this.anon();
    const response = await ctx.fetch(this.apiUrl(endpoint), { method });
    await this.setLast(response);
  },
);

// --- Shared assertions ------------------------------------------------------

Then("the response status should be {int}", function (expected) {
  assert.equal(
    this.lastStatus,
    expected,
    `expected status ${expected} but got ${this.lastStatus} (body: ${this.lastBody})`,
  );
});

Then("the response body should not expose database error details", function () {
  assert.ok(
    !/SQL|syntax error|pq:|sqlstate|GORM/i.test(this.lastBody || ""),
    `response leaked database error text: ${this.lastBody}`,
  );
});
