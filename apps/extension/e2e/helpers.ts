import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, "../dist");
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent("serviceworker");

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});

export const expect = test.expect;

export const openDialog = async (context: BrowserContext) => {
  // Create a new tab
  const page = await context.newPage();
  await page.goto("about:blank");

  // Press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+K" : "Control+K");

  // Wait for dialog to appear
  const dialog = await page.waitForSelector('[role="dialog"]');
  return { page, dialog };
};
