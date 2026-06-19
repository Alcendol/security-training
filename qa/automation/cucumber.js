// Cucumber configuration. Support files (World + hooks) are loaded before step
// definitions so the custom World is registered when steps are required.
module.exports = {
  default: {
    require: ["support/**/*.js", "steps/**/*.js"],
    // No `paths` here: with none configured Cucumber discovers features/**/*.feature
    // by default, while letting per-category npm scripts pass a single file to run.
    // `@cucumber/pretty-formatter` prints every scenario with each Given/When/Then
    // line and its pass/fail status, not just a summary.
    // Only one formatter may write to stdout; the rest must target files.
    // The custom formatter labels every scenario and step with [PASS]/[FAIL]
    // and its execution time.
    format: [
      "./formatters/scenario-status-formatter.js",
      "summary:reports/summary.txt",
      "html:reports/cucumber-report.html",
    ],
    formatOptions: { snippetInterface: "async-await" },
  },
};
