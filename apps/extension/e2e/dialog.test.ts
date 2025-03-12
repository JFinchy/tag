import { expect, openDialog, test } from "./helpers";

test.describe("Tab Management Dialog", () => {
  test("opens with keyboard shortcut", async ({ context }) => {
    const { page, dialog } = await openDialog(context);
    await expect(dialog).toBeVisible();
    await page.close();
  });

  test("shows search input", async ({ context }) => {
    const { page } = await openDialog(context);
    const searchInput = await page.getByPlaceholder(/search by title\/tags/i);
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
    await page.close();
  });

  test("lists open tabs", async ({ context }) => {
    // Create a few tabs first
    const tab1 = await context.newPage();
    await tab1.goto("https://example.com");
    const tab2 = await context.newPage();
    await tab2.goto("https://google.com");

    const { page } = await openDialog(context);

    // Check if tabs are listed
    await expect(page.getByText("example.com")).toBeVisible();
    await expect(page.getByText("google.com")).toBeVisible();

    // Cleanup
    await tab1.close();
    await tab2.close();
    await page.close();
  });

  test("can add and remove tags", async ({ context }) => {
    // Create a test tab
    const testTab = await context.newPage();
    await testTab.goto("https://example.com");

    const { page } = await openDialog(context);

    // Select the tab
    await page.getByText("example.com").click();

    // Add a tag
    const tagInput = await page.getByPlaceholder(/add a tag/i);
    await tagInput.fill("test-tag");
    await tagInput.press("Enter");

    // Verify tag was added
    await expect(page.getByText("test-tag")).toBeVisible();

    // Remove the tag
    await page.getByText("test-tag").getByRole("button").click();
    await expect(page.getByText("test-tag")).not.toBeVisible();

    // Cleanup
    await testTab.close();
    await page.close();
  });

  test("can edit tab details", async ({ context }) => {
    // Create a test tab
    const testTab = await context.newPage();
    await testTab.goto("https://example.com");

    const { page } = await openDialog(context);

    // Open edit dialog
    await page.getByText("example.com").click();
    await page.getByRole("button", { name: /edit/i }).click();

    // Edit title and description
    await page.getByLabel(/title/i).fill("Custom Title");
    await page.getByLabel(/description/i).fill("Test description");

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Verify changes
    await expect(page.getByText("Custom Title")).toBeVisible();
    await expect(page.getByText("Test description")).toBeVisible();

    // Cleanup
    await testTab.close();
    await page.close();
  });

  test("can filter tabs by tag", async ({ context }) => {
    // Create test tabs
    const tab1 = await context.newPage();
    await tab1.goto("https://example.com");
    const tab2 = await context.newPage();
    await tab2.goto("https://google.com");

    const { page } = await openDialog(context);

    // Add different tags to tabs
    await page.getByText("example.com").click();
    await page.getByPlaceholder(/add a tag/i).fill("work");
    await page.getByPlaceholder(/add a tag/i).press("Enter");

    await page.getByText("google.com").click();
    await page.getByPlaceholder(/add a tag/i).fill("search");
    await page.getByPlaceholder(/add a tag/i).press("Enter");

    // Filter by tag
    await page.getByText("work").click();

    // Verify filtering
    await expect(page.getByText("example.com")).toBeVisible();
    await expect(page.getByText("google.com")).not.toBeVisible();

    // Cleanup
    await tab1.close();
    await tab2.close();
    await page.close();
  });

  test("can sort tabs", async ({ context }) => {
    // Create test tabs
    const tab1 = await context.newPage();
    await tab1.goto("https://example.com");
    const tab2 = await context.newPage();
    await tab2.goto("https://google.com");

    const { page } = await openDialog(context);

    // Test different sort options
    const sortSelect = page.getByRole("combobox", { name: /sort by/i });

    // Sort by domain
    await sortSelect.selectOption("domain");
    const domains = await page.getByRole("listitem").allTextContents();
    expect(domains).toEqual(
      expect.arrayContaining(["example.com", "google.com"]),
    );

    // Cleanup
    await tab1.close();
    await tab2.close();
    await page.close();
  });

  test("handles suspension settings", async ({ context }) => {
    const { page } = await openDialog(context);

    // Open suspension settings
    await page.getByRole("button", { name: /suspension settings/i }).click();

    // Toggle suspension
    const enableToggle = page.getByLabel(/enable tab suspension/i);
    await enableToggle.click();
    await expect(enableToggle).not.toBeChecked();

    // Set memory threshold
    await page.getByLabel(/memory threshold/i).fill("1000");

    // Add a rule
    await page.getByRole("button", { name: /add rule/i }).click();
    await page.getByPlaceholder("example.com").fill("example.com");
    await page.getByRole("combobox").selectOption("never");

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Verify dialog closed
    await expect(page.getByText(/suspension settings/i)).not.toBeVisible();

    await page.close();
  });
});
