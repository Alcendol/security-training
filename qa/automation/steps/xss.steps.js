const assert = require("node:assert/strict");
const { Given, When, Then } = require("@cucumber/cucumber");

// Mirrors Go's html.EscapeString so assertions tolerate defense-in-depth
// server-side escaping: a payload may be rendered either raw (React escapes on
// render) or already HTML-entity encoded by the backend. Either form is inert.
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&#34;");
}

async function assertRenderedInert(page, payload) {
  // The payload must appear as visible text (raw or entity-encoded), never as
  // a live element.
  const bodyText = await page.locator("body").innerText();
  assert.ok(
    bodyText.includes(payload) || bodyText.includes(escapeHtml(payload)),
    `payload was not found as inert text on the page`,
  );
  const liveScripts = await page.locator('script:has-text("alert(")').count();
  assert.equal(liveScripts, 0, "payload created a live <script> element");
  const liveImgs = await page.locator("img[onerror]").count();
  assert.equal(liveImgs, 0, "payload created a live <img onerror> element");
}

When("I create a task with description {string}", async function (description) {
  const page = this.page;
  const title = `XSS Task ${this.runId}`;
  this.state.xssTaskTitle = title;
  await page.fill('input[placeholder="Task title"]', title);
  await page.fill('textarea[placeholder="Task description"]', description);
  await page.click('button:has-text("Create Task")');
  // Wait for the task to render so any unsafe HTML would have had a chance to run.
  await page.getByText(title, { exact: false }).first().waitFor({ state: "visible" });
});

Given("I open the profile page", async function () {
  const page = this.page;
  await page.getByRole("link", { name: "Profile" }).click();
  await page.waitForURL("**/profile");
});

When("I update my bio to {string}", async function (bio) {
  const page = this.page;
  // Name is a required field; ensure it is populated so the form submits.
  const nameInput = page.locator('input[name="name"]');
  if (!(await nameInput.inputValue())) {
    await nameInput.fill("QA Tester");
  }
  await page.fill('textarea[name="bio"]', bio);
  await page.click('button:has-text("Update Profile")');
  await page.getByText("Profile updated successfully!").waitFor({ state: "visible" });
});

Then("no JavaScript dialog should be triggered", async function () {
  // Give any deferred handler (e.g. img onerror) a tick to fire.
  await this.page.waitForTimeout(300);
  assert.equal(
    this.dialogs.length,
    0,
    `XSS executed — JS dialog(s) fired: ${JSON.stringify(this.dialogs)}`,
  );
});

Then(
  "the task description {string} should be displayed as text",
  async function (payload) {
    await assertRenderedInert(this.page, payload);
  },
);

Then(
  "the bio {string} should be displayed as text on the profile page",
  async function (payload) {
    await assertRenderedInert(this.page, payload);
  },
);
