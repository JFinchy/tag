// https://playwright.dev/docs/accessibility-testing

import { expect, test } from './fixtures';
import { formatViolations, isFocusTrapped, runA11yScan } from './helpers/a11y-helpers';

test.describe('Accessibility tests', () => {
  test('should not have any automatically detectable accessibility issues on the popup page', async ({ page, extensionId }) => {
    // Navigate to the extension popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Run the accessibility scan using our helper
    const results = await runA11yScan(page);
    
    // Log formatted violations for better debugging
    console.log(formatViolations(results.violations));
    
    // Assert no violations are found
    expect(results.violations).toEqual([]);
  });

  test('should not have any automatically detectable accessibility issues on the tabs modal', async ({ page, extensionId }) => {
    // Navigate to the tabs modal page (adjust the URL as needed)
    await page.goto(`chrome-extension://${extensionId}/tabs-modal.html`);
    
    // Run the accessibility scan with specific options
    const results = await runA11yScan(page, {
      // Exclude elements that might be problematic but aren't critical
      exclude: ['.non-critical-element'],
      // Disable specific rules if needed
      disableRules: ['color-contrast']
    });
    
    // Log formatted violations for better debugging
    console.log(formatViolations(results.violations));
    
    // If you expect some violations that can't be fixed immediately, you can use this approach:
    // expect(results.violations.length).toBeLessThanOrEqual(expectedViolationCount);
    
    // For stricter testing, assert no violations
    expect(results.violations).toEqual([]);
  });

  // You can add more specific tests for different pages or components
  test('should have proper focus management in the dialog components', async ({ page, extensionId }) => {
    // Navigate to a page with dialogs
    await page.goto(`chrome-extension://${extensionId}/tabs-modal.html`);
    
    // Open a dialog (adjust the selector as needed)
    await page.click('button:has-text("Open Dialog")');
    
    // Check that focus is trapped within the dialog using our helper
    const dialogSelector = '[role="dialog"]';
    const focusIsTrapped = await isFocusTrapped(page, dialogSelector);
    
    expect(focusIsTrapped).toBe(true);
  });
});