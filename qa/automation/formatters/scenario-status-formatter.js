// Custom Cucumber formatter: prints every feature → scenario → step with an
// explicit [PASS]/[FAIL]/[SKIP] label and execution time, plus a final totals
// block with the overall run duration.
//
// Referenced from cucumber.js as the stdout formatter. It lives outside the
// `support/` and `steps/` require globs so it is not loaded as support code.
const { Formatter, formatterHelpers } = require("@cucumber/cucumber");

function timestampToMs(ts) {
  if (!ts) return 0;
  return ts.seconds * 1000 + ts.nanos / 1e6;
}

function durationToMs(duration) {
  if (!duration) return 0;
  return Math.round(duration.seconds * 1000 + duration.nanos / 1e6);
}

const LABELS = {
  PASSED: "[PASS]",
  FAILED: "[FAIL]",
  SKIPPED: "[SKIP]",
  PENDING: "[PEND]",
  UNDEFINED: "[UNDF]",
  AMBIGUOUS: "[AMBG]",
  UNKNOWN: "[????]",
};

class ScenarioStatusFormatter extends Formatter {
  constructor(options) {
    super(options);
    this.startTimes = new Map(); // testCaseStartedId -> start timestamp (ms)
    this.evidence = new Map(); // testCaseStartedId -> [evidence paths]
    this.runStartMs = 0;
    this.counts = { PASSED: 0, FAILED: 0, SKIPPED: 0, PENDING: 0, UNDEFINED: 0, AMBIGUOUS: 0, UNKNOWN: 0 };
    this.currentUri = null;

    options.eventBroadcaster.on("envelope", (envelope) => {
      if (envelope.testRunStarted) {
        this.runStartMs = timestampToMs(envelope.testRunStarted.timestamp);
      } else if (envelope.testCaseStarted) {
        this.startTimes.set(
          envelope.testCaseStarted.id,
          timestampToMs(envelope.testCaseStarted.timestamp),
        );
      } else if (envelope.attachment) {
        this.onAttachment(envelope.attachment);
      } else if (envelope.testCaseFinished) {
        this.onTestCaseFinished(envelope.testCaseFinished);
      } else if (envelope.testRunFinished) {
        this.onTestRunFinished(envelope.testRunFinished);
      }
    });
  }

  onAttachment(attachment) {
    // Collect the "Evidence: <path>" text attachments emitted by the After hook.
    const id = attachment.testCaseStartedId;
    if (!id || attachment.mediaType !== "text/plain") return;
    const body = String(attachment.body || "");
    if (!body.startsWith("Evidence:")) return;
    if (!this.evidence.has(id)) this.evidence.set(id, []);
    this.evidence.get(id).push(body.replace(/^Evidence:\s*/, "").trim());
  }

  colored(status, text) {
    // Reuse Cucumber's status colors (respects TTY / --format-options colorsEnabled).
    const fn = this.colorFns && this.colorFns.forStatus;
    return fn ? fn(status)(text) : text;
  }

  onTestCaseFinished(testCaseFinished) {
    const attempt = this.eventDataCollector.getTestCaseAttempt(
      testCaseFinished.testCaseStartedId,
    );
    const parsed = formatterHelpers.parseTestCaseAttempt({
      cwd: this.cwd,
      snippetBuilder: this.snippetBuilder,
      supportCodeLibrary: this.supportCodeLibrary,
      testCaseAttempt: attempt,
    });

    const status = attempt.worstTestStepResult.status;
    this.counts[status] = (this.counts[status] || 0) + 1;

    const endMs = timestampToMs(testCaseFinished.timestamp);
    const startMs = this.startTimes.get(testCaseFinished.testCaseStartedId) || endMs;
    const scenarioMs = Math.max(0, Math.round(endMs - startMs));

    // Print the feature heading once per feature file.
    const uri = attempt.gherkinDocument.uri;
    if (uri !== this.currentUri) {
      this.currentUri = uri;
      const featureName = attempt.gherkinDocument.feature
        ? attempt.gherkinDocument.feature.name
        : uri;
      this.log(`\nFeature: ${featureName}  # ${uri}\n`);
    }

    const label = LABELS[status] || LABELS.UNKNOWN;
    this.log(
      `  ${this.colored(status, label)} Scenario: ${parsed.testCase.name}  (${scenarioMs}ms)\n`,
    );

    for (const step of parsed.testSteps) {
      // Skip hooks (Before/After) — they have no Gherkin step text.
      if (step.text == null || step.text === "") continue;
      const stepStatus = step.result.status;
      const stepLabel = LABELS[stepStatus] || LABELS.UNKNOWN;
      const stepMs = durationToMs(step.result.duration);
      this.log(
        `      ${this.colored(stepStatus, stepLabel)} ${step.keyword}${step.text}  (${stepMs}ms)\n`,
      );
      if (stepStatus === "FAILED" && step.result.message) {
        const indented = step.result.message
          .split("\n")
          .map((line) => `          ${line}`)
          .join("\n");
        this.log(`${indented}\n`);
      }
    }

    const evidence = this.evidence.get(testCaseFinished.testCaseStartedId) || [];
    for (const file of evidence) {
      this.log(`      📸 evidence: ${file}\n`);
    }
  }

  onTestRunFinished(testRunFinished) {
    const totalMs = Math.round(timestampToMs(testRunFinished.timestamp) - this.runStartMs);
    const total = Object.values(this.counts).reduce((a, b) => a + b, 0);
    const overall = this.counts.FAILED > 0 ? "FAILED" : "PASSED";

    const parts = [];
    for (const [status, count] of Object.entries(this.counts)) {
      if (count > 0) parts.push(`${count} ${status.toLowerCase()}`);
    }

    this.log("\n" + "-".repeat(63) + "\n");
    this.log(
      `  RESULT: ${this.colored(overall, `[${overall}]`)}  ` +
        `${total} scenarios (${parts.join(", ")})  in ${totalMs}ms\n`,
    );
    this.log("-".repeat(63) + "\n");
  }
}

module.exports = ScenarioStatusFormatter;
