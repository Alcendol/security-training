const { setWorldConstructor, World } = require("@cucumber/cucumber");
const { chromium, request } = require("playwright");
const config = require("./config");

let runCounter = 0;

// Custom Cucumber World that wires Playwright into every scenario. A fresh
// instance is created per scenario, so per-scenario state (sessions, captured
// responses, JS dialogs) is naturally isolated.
class SecureTaskWorld extends World {
  constructor(options) {
    super(options);
    this.config = config;
    this.runId = `${Date.now()}-${process.pid}-${(runCounter += 1)}`;

    this.browser = null;
    this.browserContext = null;
    this.page = null;

    // Named Playwright APIRequestContexts. Each keeps its own cookie jar, so
    // separate logical users get separate sessions.
    this.apiContexts = {};
    // alias -> { ctxName, email, password, user }
    this.users = {};

    // JS dialogs (alert/confirm/prompt) raised in the browser — should stay
    // empty for a site that is safe from XSS.
    this.dialogs = [];

    // Scratch space for the most recent API response so generic Then steps can
    // assert on it.
    this.lastResponse = null;
    this.lastStatus = null;
    this.lastBody = null;

    this.state = {};
  }

  uniqueEmail(label) {
    return `qa-${label}-${this.runId}@example.com`;
  }

  // --- Browser helpers -----------------------------------------------------

  async launchBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: !this.config.headed,
        slowMo: this.config.slowMo,
      });
    }
  }

  async openPage() {
    if (this.page) return this.page;
    await this.launchBrowser();
    this.browserContext = await this.browser.newContext();
    this.page = await this.browserContext.newPage();
    this.page.on("dialog", async (dialog) => {
      this.dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    return this.page;
  }

  async loginViaUi(email, password) {
    const page = await this.openPage();
    await page.goto(`${this.config.frontendUrl}/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Login")');
    await page.waitForURL("**/dashboard");
    return page;
  }

  // --- API helpers ---------------------------------------------------------

  async api(name = "default") {
    if (!this.apiContexts[name]) {
      this.apiContexts[name] = await request.newContext();
    }
    return this.apiContexts[name];
  }

  // Builds an absolute API URL. We avoid Playwright's baseURL join because a
  // leading-slash path ("/auth/login") would replace the base path and drop the
  // "/api" prefix.
  apiUrl(path) {
    return this.config.apiBaseUrl + (path.startsWith("/") ? path : `/${path}`);
  }

  // Anonymous context that is never authenticated.
  async anon() {
    return this.api("__anon__");
  }

  // Registers a new user and logs them in on a dedicated API context, then
  // records them under `alias`.
  async registerFreshUser(alias) {
    const ctxName = `user:${alias}`;
    const email = this.uniqueEmail(alias);
    const password = "StrongPass123!";
    const ctx = await this.api(ctxName);

    const register = await ctx.post(this.apiUrl("/auth/register"), {
      data: { email, password, name: `QA ${alias}` },
    });
    if (![200, 201, 409].includes(register.status())) {
      throw new Error(`register(${alias}) -> ${register.status()}: ${await register.text()}`);
    }

    const login = await ctx.post(this.apiUrl("/auth/login"), { data: { email, password } });
    if (login.status() !== 200) {
      throw new Error(`login(${alias}) -> ${login.status()}: ${await login.text()}`);
    }
    const body = await login.json();
    const user = body.user;
    if (!user || !user.id) {
      throw new Error(`login(${alias}) returned no user id`);
    }

    this.users[alias] = { ctxName, email, password, user };
    await this.setLast(login);
    return this.users[alias];
  }

  // Returns the already-created API context for a logged-in alias. Synchronous
  // because the context is created (and awaited) during login.
  userCtx(alias) {
    const record = this.users[alias];
    if (!record) throw new Error(`unknown user alias "${alias}" — log them in first`);
    const ctx = this.apiContexts[record.ctxName];
    if (!ctx) throw new Error(`API context for "${alias}" was not initialised`);
    return ctx;
  }

  // Records the most recent API response for generic assertions.
  async setLast(response) {
    this.lastResponse = response;
    this.lastStatus = response.status();
    this.lastBody = await response.text();
    try {
      this.lastJson = JSON.parse(this.lastBody);
    } catch {
      this.lastJson = null;
    }
    return response;
  }

  // --- Teardown ------------------------------------------------------------

  async cleanup() {
    for (const ctx of Object.values(this.apiContexts)) {
      await ctx.dispose();
    }
    this.apiContexts = {};
    if (this.page) await this.page.close().catch(() => {});
    if (this.browserContext) await this.browserContext.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
    this.page = null;
    this.browserContext = null;
    this.browser = null;
  }
}

setWorldConstructor(SecureTaskWorld);
