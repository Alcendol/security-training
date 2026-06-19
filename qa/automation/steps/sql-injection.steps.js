const assert = require("node:assert/strict");
const { Given, When, Then } = require("@cucumber/cucumber");

Given(
  "I have created a task titled {string} with description {string}",
  async function (title, description) {
    const ctx = this.userCtx("me");
    const response = await ctx.post(this.apiUrl("/tasks"), {
      data: { title, description, priority: "medium" },
    });
    assert.ok(
      [200, 201].includes(response.status()),
      `create task -> ${response.status()}: ${await response.text()}`,
    );
    this.state.baselineTask = await response.json();
  },
);

When("I search tasks via the API for {string}", async function (term) {
  const ctx = this.userCtx("me");
  const response = await ctx.get(this.apiUrl(`/tasks/search?q=${encodeURIComponent(term)}`));
  await this.setLast(response);
});

Then("the search results should not contain the baseline task", function () {
  const rows = Array.isArray(this.lastJson) ? this.lastJson : [];
  const baseline = this.state.baselineTask || {};
  const leaked = rows.some(
    (row) => row.id === baseline.id || row.title === baseline.title,
  );
  assert.ok(
    !leaked,
    `injection payload leaked the baseline task: ${JSON.stringify(rows)}`,
  );
});

Then("the search results should contain a task titled {string}", function (title) {
  const rows = Array.isArray(this.lastJson) ? this.lastJson : [];
  assert.ok(
    rows.some((row) => row.title === title),
    `expected a task titled "${title}" but got: ${JSON.stringify(rows)}`,
  );
});

// --- Dashboard (browser) variant -------------------------------------------

Given(
  "I have created a task titled {string} through the dashboard",
  async function (title) {
    const page = this.page;
    await page.fill('input[placeholder="Task title"]', title);
    await page.fill('textarea[placeholder="Task description"]', "ui baseline content");
    await page.click('button:has-text("Create Task")');
    // Wait for the new task to render in the list.
    await page.getByText(title, { exact: false }).first().waitFor({ state: "visible" });
  },
);

When("I search in the dashboard for {string}", async function (term) {
  const page = this.page;
  await page.fill('input[placeholder="Search tasks..."]', term);
  await page.click('button:has-text("Search")');
  // Results render inside a <pre> once the request resolves.
  await page.locator("pre").waitFor({ state: "visible" });
});

Then(
  "the dashboard search results should not include {string}",
  async function (title) {
    const resultsText = await this.page.locator("pre").innerText();
    assert.ok(
      !resultsText.includes(title),
      `injection payload leaked "${title}" into dashboard results: ${resultsText}`,
    );
  },
);
