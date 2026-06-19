const fs = require("node:fs");
const path = require("node:path");
const { BeforeAll, After, setDefaultTimeout } = require("@cucumber/cucumber");
const config = require("./config");

// Browser launch + brute-force loops can take a while; allow generous time.
setDefaultTimeout(60 * 1000);

// Start each run with a clean evidence directory.
BeforeAll(function () {
  fs.rmSync(config.evidenceDir, { recursive: true, force: true });
});

// Returns a path that does not yet exist, so repeated Scenario Outline rows
// (which share a scenario name) each get their own evidence file within a run.
function uniquePath(dir, base, ext) {
  let candidate = path.join(dir, `${base}.${ext}`);
  let n = 1;
  while (fs.existsSync(candidate)) {
    n += 1;
    candidate = path.join(dir, `${base}-${n}.${ext}`);
  }
  return candidate;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Capture evidence for every scenario, then tear down. Browser scenarios get a
// full-page screenshot; API/static scenarios get a text transcript of the last
// response. Evidence is both saved to disk (qa/automation/evidence/...) and
// attached to the HTML report so each scenario has a tangible artifact.
After(async function ({ pickle, result }) {
  const status = (result && result.status) || "UNKNOWN";
  const feature = slug((pickle.uri || "feature").split("/").pop().replace(/\.feature$/, ""));
  const dir = path.join(this.config.evidenceDir, feature);
  const base = `${slug(pickle.name)}__${status}`;

  try {
    fs.mkdirSync(dir, { recursive: true });

    if (this.page && !this.page.isClosed()) {
      const file = uniquePath(dir, base, "png");
      const buffer = await this.page.screenshot({ fullPage: true });
      fs.writeFileSync(file, buffer);
      await this.attach(buffer, "image/png");
      await this.attach(`Evidence: ${path.relative(this.config.repoRoot, file)}`, "text/plain");
    } else if (this.lastResponse) {
      const transcript =
        `Scenario: ${pickle.name}\n` +
        `Status: ${status}\n` +
        `Last API response: HTTP ${this.lastStatus}\n` +
        `Body: ${this.lastBody || "(empty)"}\n`;
      const file = uniquePath(dir, base, "txt");
      fs.writeFileSync(file, transcript);
      await this.attach(transcript, "text/plain");
      await this.attach(`Evidence: ${path.relative(this.config.repoRoot, file)}`, "text/plain");
    }
  } catch (err) {
    // Never let evidence capture mask the real scenario result.
    await this.attach(`Evidence capture failed: ${err.message}`, "text/plain");
  }

  await this.cleanup();
});
