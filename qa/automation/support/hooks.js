const { After, setDefaultTimeout } = require("@cucumber/cucumber");

// Browser launch + brute-force loops can take a while; allow generous time.
setDefaultTimeout(60 * 1000);

After(async function () {
  await this.cleanup();
});
