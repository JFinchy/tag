import { defineConfig, devices } from "@playwright/test";

import path from "path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "chrome-extension://[extension-id]/",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        contextOptions: {
          permissions: ["tabs"],
          extensions: [path.join(__dirname, "dist")],
        },
      },
    },
  ],
});
