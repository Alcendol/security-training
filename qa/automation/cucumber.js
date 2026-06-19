// Cucumber configuration. Support files (World + hooks) are loaded before step
// definitions so the custom World is registered when steps are required.
module.exports = {
  default: {
    require: ["support/**/*.js", "steps/**/*.js"],
    // No `paths` here: with none configured Cucumber discovers features/**/*.feature
    // by default, while letting per-category npm scripts pass a single file to run.
    format: ["progress-bar", "summary", "html:reports/cucumber-report.html"],
    formatOptions: { snippetInterface: "async-await" },
  },
};
