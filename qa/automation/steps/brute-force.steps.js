const assert = require("node:assert/strict");
const { Given, When, Then } = require("@cucumber/cucumber");

Given("a throwaway target account for brute force testing", function () {
  // Unique per run so locking it out never affects the seeded accounts used by
  // the UI scenarios (the backend keys throttling on IP + email).
  this.state.bruteForceEmail = this.uniqueEmail("bruteforce-target");
});

When("I send {int} failed login attempts for that account", async function (count) {
  const ctx = await this.anon();
  const statuses = [];
  let throttledResponse = null;
  for (let i = 0; i < count; i += 1) {
    const response = await ctx.post(this.apiUrl("/auth/login"), {
      data: { email: this.state.bruteForceEmail, password: `wrong-${i}` },
    });
    statuses.push(response.status());
    if (response.status() === 429 && !throttledResponse) {
      throttledResponse = response;
    }
  }
  this.state.bruteForceStatuses = statuses;
  this.state.throttledResponse = throttledResponse;
  // Record a representative response so the scenario produces evidence.
  if (throttledResponse) await this.setLast(throttledResponse);
});

Then(
  "at least one login attempt should be throttled with status {int}",
  function (status) {
    const statuses = this.state.bruteForceStatuses || [];
    assert.ok(
      statuses.includes(status),
      `no ${status} response observed; statuses were: ${statuses.join(", ")}`,
    );
  },
);

Then("the throttled response should include a Retry-After header", function () {
  const response = this.state.throttledResponse;
  assert.ok(response, "no throttled (429) response was captured");
  const retryAfter = response.headers()["retry-after"];
  assert.ok(retryAfter, "throttled response is missing a Retry-After header");
});

When("I register with a weak password {string}", async function (password) {
  const ctx = await this.anon();
  const response = await ctx.post(this.apiUrl("/auth/register"), {
    data: { email: this.uniqueEmail("weak"), password, name: "Weak QA" },
  });
  await this.setLast(response);
});
