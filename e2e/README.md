# End-to-End Testing

This directory contains end-to-end tests for the Tag browser extension using Playwright.

## Running Tests

To run all tests:

```bash
pnpm test
```

To run a specific test file:

```bash
pnpm test -- e2e/a11y.spec.ts
```

To run tests in headed mode (with browser UI visible):

```bash
pnpm test -- --headed
```

## Accessibility Testing

We use [@axe-core/playwright](https://github.com/dequelabs/axe-core-playwright) for automated accessibility testing. This helps us ensure our extension is accessible to all users.

### Helper Functions

We've created several helper functions in `helpers/a11y-helpers.ts` to make accessibility testing easier:

- `runA11yScan(page, options)`: Run an accessibility scan on the current page with configurable options
- `formatViolations(violations)`: Format accessibility violations for better readability in test output
- `isKeyboardFocusable(page, selector)`: Check if an element is keyboard focusable
- `isFocusTrapped(page, containerSelector, tabCount)`: Check if focus is trapped within a container

### Example Usage

```typescript
import { test, expect } from './fixtures';
import { runA11yScan, formatViolations } from './helpers/a11y-helpers';

test('should not have accessibility issues', async ({ page }) => {
  await page.goto('https://example.com');
  
  const results = await runA11yScan(page);
  
  // Log formatted violations for better debugging
  console.log(formatViolations(results.violations));
  
  // Assert no violations are found
  expect(results.violations).toEqual([]);
});
```

### Common Accessibility Checks

1. **WCAG Compliance**: Check for WCAG 2.1 AA compliance using axe-core
2. **Keyboard Navigation**: Ensure all interactive elements are keyboard accessible
3. **Focus Management**: Verify focus is properly managed, especially in dialogs
4. **Screen Reader Compatibility**: Test with screen readers to ensure content is properly announced
5. **Color Contrast**: Ensure text has sufficient contrast against its background

## Test Structure

- `fixtures.ts`: Contains test fixtures for the extension
- `a11y.spec.ts`: Accessibility tests
- `main.spec.ts`: Main functionality tests
- `helpers/`: Helper functions for testing

## Adding New Tests

When adding new tests, consider:

1. What user flows are you testing?
2. Are there accessibility considerations for these flows?
3. How can you make your tests resilient to UI changes?

For accessibility tests, focus on:

1. Automated checks using axe-core
2. Keyboard navigation testing
3. Focus management in interactive components 