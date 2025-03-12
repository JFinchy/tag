import type { Message, ProcessInfo, Tab } from '../src/types';

import type { Tabs } from 'webextension-polyfill';
import { browser } from 'wxt/browser';

interface TabInfo extends Tab {
  lastActiveTimestamp?: number;
  bookmarked?: boolean;
}

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

  // Function to get updated tabs
  async function getUpdatedTabs(): Promise<Tab[]> {
    console.log('Getting updated tabs...');
    try {
      const tabs = await browser.tabs.query({});
      console.log('Found tabs:', tabs);
      
      // Get process info for tabs
      const tabIds = tabs.map(tab => tab.id).filter((id): id is number => id !== undefined);
      const processInfo = await browser.processes?.getProcessInfo(tabIds) || [];
      console.log('Process info:', processInfo);

      // Get bookmarks
      const bookmarks = await browser.bookmarks.search({});
      const bookmarkedUrls = new Set(bookmarks.map(b => b.url));
      console.log('Bookmarked URLs:', bookmarkedUrls);

      // Map tabs to our format
      const mappedTabs = tabs.map((tab: Tabs.Tab): Tab => {
        const process = processInfo.find((p: ProcessInfo) => p.id === tab.id);
        return {
          ...tab,
          processId: tab.id,
          bookmarked: tab.url ? bookmarkedUrls.has(tab.url) : false,
          memoryInfo: process ? {
            privateMemory: process.privateMemory,
            jsMemoryUsed: process.jsMemoryUsed
          } : undefined
        };
      });

      console.log('Mapped tabs:', mappedTabs);
      return mappedTabs;
    } catch (error) {
      console.error('Error getting updated tabs:', error);
      return [];
    }
  }

  function getAllBookmarkUrls(nodes: browser.bookmarks.BookmarkTreeNode[]): string[] {
    const urls: string[] = [];
    for (const node of nodes) {
      if (node.url) {
        urls.push(node.url);
      }
      if (node.children) {
        urls.push(...getAllBookmarkUrls(node.children));
      }
    }
    return urls;
  }

  // Function to notify all content scripts about tab updates
  async function notifyTabsUpdated(tabs: Tab[]) {
    console.log('Notifying about tab updates:', tabs);
    try {
      const windows = await browser.tabs.query({});
      for (const window of windows) {
        if (window.id) {
          await browser.tabs.sendMessage(window.id, {
            action: 'tabsUpdated',
            tabs
          }).catch(() => {
            // Ignore errors for tabs that don't have the content script
          });
        }
      }
    } catch (error) {
      console.error('Error notifying about tab updates:', error);
    }
  }

  // Listen for tab events
  browser.tabs.onCreated.addListener(async () => {
    console.log('Tab created');
    const tabs = await getUpdatedTabs();
    await notifyTabsUpdated(tabs);
  });
  browser.tabs.onRemoved.addListener(async () => {
    console.log('Tab removed');
    const tabs = await getUpdatedTabs();
    await notifyTabsUpdated(tabs);
  });
  browser.tabs.onUpdated.addListener(async () => {
    console.log('Tab updated');
    const tabs = await getUpdatedTabs();
    await notifyTabsUpdated(tabs);
  });
  browser.tabs.onMoved.addListener(() => notifyTabsUpdated(tabs));
  browser.tabs.onActivated.addListener(() => notifyTabsUpdated(tabs));
  browser.bookmarks.onCreated.addListener(async () => {
    console.log('Bookmark created');
    const tabs = await getUpdatedTabs();
    await notifyTabsUpdated(tabs);
  });
  browser.bookmarks.onRemoved.addListener(async () => {
    console.log('Bookmark removed');
    const tabs = await getUpdatedTabs();
    await notifyTabsUpdated(tabs);
  });
  browser.bookmarks.onChanged.addListener(() => notifyTabsUpdated(tabs));

  // Listen for messages from content scripts
  browser.runtime.onMessage.addListener(async (message: Message) => {
    console.log('Received message:', message);
    try {
      switch (message.action) {
        case 'getTabs':
          const tabs = await getUpdatedTabs();
          return tabs;
        case 'openDialog':
          await openDialog();
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
    return true;
  });

  // For debugging: log when extension is installed or updated
  browser.runtime.onInstalled.addListener((details) => {
    console.log("Extension installed/updated:", details.reason);
  });

  // Function to open the dialog
  async function openDialog() {
    console.log('Opening dialog...');
    try {
      // Create a new tab with our dialog
      const tab = await browser.tabs.create({
        url: browser.runtime.getURL('tabs-modal.html'),
        active: true
      });
      console.log('Dialog opened in tab:', tab);
    } catch (error) {
      console.error('Error opening dialog:', error);
    }
  }

  // Listen for keyboard shortcuts
  browser.commands.onCommand.addListener(async (command) => {
    console.log('Command received:', command);
    if (command === 'open-dialog') {
      await openDialog();
    }
  });

  // Initial setup
  console.log('Background script starting...');
});
