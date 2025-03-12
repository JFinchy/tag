// https://playwright.dev/docs/chrome-extensions
const { chromium } = require("playwright");

(async () => {
  const pathToExtension = require("path").join(__dirname, "my-extension");
  const userDataDir = "/tmp/test-user-data-dir";
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });
  let [backgroundPage] = browserContext.backgroundPages();
  if (!backgroundPage)
    backgroundPage = await browserContext.waitForEvent("backgroundpage");

  // Test the background page as you would any other page.
  await browserContext.close();
})();
