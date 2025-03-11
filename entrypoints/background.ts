import { browser } from "wxt/browser";

export default defineBackground(() => {
  // Function to get domain from URL
  function getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  // Function to organize tabs by domain
  async function organizeTabsByDomain() {
    const tabs = await browser.tabs.query({});
    const tabsByDomain = new Map<string, browser.tabs.Tab[]>();

    // Group tabs by domain
    tabs.forEach((tab) => {
      if (tab.url) {
        const domain = getDomain(tab.url);
        if (!tabsByDomain.has(domain)) {
          tabsByDomain.set(domain, []);
        }
        tabsByDomain.get(domain)?.push(tab);
      }
    });

    // Reorder tabs to keep domains together
    let index = 0;
    for (const [domain, domainTabs] of tabsByDomain) {
      console.log(`Organizing tabs for domain: ${domain}`);
      for (const tab of domainTabs) {
        await browser.tabs.move(tab.id!, { index: index++ });
      }
    }
  }

  // Function to handle new tab creation
  async function handleTabCreated(tab: browser.tabs.Tab) {
    if (!tab.url || !tab.id) return;

    const domain = getDomain(tab.url);
    const existingTabs = await browser.tabs.query({ url: tab.url });

    // If there's already a tab with this URL
    if (existingTabs.length > 1) {
      // Find the first tab that isn't the newly created one
      const existingTab = existingTabs.find((t) => t.id !== tab.id);
      if (existingTab?.id) {
        // Activate the existing tab
        await browser.tabs.update(existingTab.id, { active: true });
        // Close the new tab
        await browser.tabs.remove(tab.id);
        return;
      }
    }

    // If it's a new unique tab, find tabs with the same domain
    const sameDomainTabs = await browser.tabs.query({});
    const lastSameDomainTab = sameDomainTabs
      .filter((t) => t.url && getDomain(t.url) === domain && t.id !== tab.id)
      .pop();

    // If there are other tabs with the same domain, move the new tab next to them
    if (lastSameDomainTab?.index !== undefined) {
      await browser.tabs.move(tab.id, { index: lastSameDomainTab.index + 1 });
    }
  }

  // Listen for tab creation
  browser.tabs.onCreated.addListener(async (tab) => {
    // Wait a bit for the URL to be set
    setTimeout(async () => {
      const updatedTab = await browser.tabs.get(tab.id!);
      await handleTabCreated(updatedTab);
    }, 100);
  });

  // Listen for tab updates (URL changes)
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      await handleTabCreated(tab);
    }
  });

  // Initial organization
  organizeTabsByDomain();

  // Re-organize periodically (every 5 minutes)
  setInterval(organizeTabsByDomain, 5 * 60 * 1000);

  // Handle messages from content script
  browser.runtime.onMessage.addListener(async (message) => {
    if (message.action === "getTabs") {
      const tabs = await browser.tabs.query({});
      return tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        active: tab.active,
      }));
    }
  });

  // For debugging: log when extension is installed or updated
  browser.runtime.onInstalled.addListener((details) => {
    console.log("Extension installed/updated:", details.reason);
  });
});
