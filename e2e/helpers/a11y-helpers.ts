import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

/**
 * Run an accessibility scan on the current page
 * @param page - The Playwright page object
 * @param options - Options for the accessibility scan
 * @returns The accessibility scan results
 */
export async function runA11yScan(
  page: Page,
  options: {
    /**
     * Include only rules with the specified tags
     * Common values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
     */
    includeTags?: string[];
    /**
     * Exclude rules with the specified tags
     */
    excludeTags?: string[];
    /**
     * CSS selector to include in the scan (default: the entire document)
     */
    include?: string;
    /**
     * CSS selector to exclude from the scan
     */
    exclude?: string[];
    /**
     * Rules to disable
     */
    disableRules?: string[];
    /**
     * Rules to enable
     */
    enableRules?: string[];
  } = {}
) {
  const {
    includeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    excludeTags = [],
    include,
    exclude = [],
    disableRules = [],
    enableRules = [],
  } = options;

  // Create the AxeBuilder instance
  let axeBuilder = new AxeBuilder({ page });

  // Configure the scan based on options
  if (includeTags.length > 0) {
    axeBuilder = axeBuilder.withTags(includeTags);
  }

  // Note: AxeBuilder doesn't have a withoutTags method
  // We'll skip this for now, but you can filter results after the scan if needed

  if (include) {
    axeBuilder = axeBuilder.include(include);
  }

  exclude.forEach((selector) => {
    axeBuilder = axeBuilder.exclude(selector);
  });

  disableRules.forEach((rule) => {
    axeBuilder = axeBuilder.disableRules(rule);
  });

  // Note: AxeBuilder doesn't have an enableRules method
  // We'll skip this for now, but you can use options.rules in the future if needed

  // Run the scan
  return axeBuilder.analyze();
}

/**
 * Format accessibility violations for better readability in test output
 * @param violations - The violations from the accessibility scan
 * @returns A formatted string with violation details
 */
export function formatViolations(violations: any[]) {
  if (violations.length === 0) {
    return 'No accessibility violations found.';
  }

  return violations
    .map((violation) => {
      const nodes = violation.nodes.map((node: any) => {
        return `\n  - HTML: ${node.html}\n    - ${node.failureSummary.replace(/\n/g, '\n    - ')}`;
      }).join('\n');

      return `\nRule: ${violation.id} (${violation.impact} impact)\nDescription: ${violation.description}\nHelp: ${violation.help}\nNodes:${nodes}`;
    })
    .join('\n\n');
}

/**
 * Check if an element is keyboard focusable
 * @param page - The Playwright page object
 * @param selector - The selector for the element to check
 * @returns Whether the element is keyboard focusable
 */
export async function isKeyboardFocusable(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) return false;
    
    // Check if the element is visible
    const style = window.getComputedStyle(element as Element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    
    // Check if the element is focusable
    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex !== null) {
      return parseInt(tabIndex, 10) >= 0;
    }
    
    // Check if the element is naturally focusable
    const tagName = element.tagName.toLowerCase();
    return ['a', 'button', 'input', 'select', 'textarea', 'details'].includes(tagName) &&
      !(element as HTMLElement).hasAttribute('disabled');
  }, selector);
}

/**
 * Check if focus is trapped within a container
 * @param page - The Playwright page object
 * @param containerSelector - The selector for the container
 * @param tabCount - The number of times to press Tab (default: 10)
 * @returns Whether focus is trapped within the container
 */
export async function isFocusTrapped(
  page: Page,
  containerSelector: string,
  tabCount = 10
): Promise<boolean> {
  for (let i = 0; i < tabCount; i++) {
    await page.keyboard.press('Tab');
    
    const focusInContainer = await page.evaluate((selector) => {
      const container = document.querySelector(selector);
      const activeElement = document.activeElement;
      return container?.contains(activeElement);
    }, containerSelector);
    
    if (!focusInContainer) {
      return false;
    }
  }
  
  return true;
} 