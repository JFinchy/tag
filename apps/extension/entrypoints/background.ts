import type { Message, ProcessInfo, Tab } from '../src/types';

import type { Tabs } from 'webextension-polyfill';
import { browser } from 'wxt/browser';

interface BookmarkItem {
  title: string;
  url?: string;
  tags?: string[];
  children?: BookmarkItem[];
}
interface BookmarkStructure {
  bookmarksBar: BookmarkItem[];
  other: BookmarkItem[];
}

// Default bookmarks structure
const BOOKMARK_STRUCTURE: BookmarkStructure = {
  bookmarksBar: [
    {
      title: "Quick Links",
      children: [
        {
          title: "Facebook",
          url: "https://www.facebook.com",
          tags: ["social", "facebook"],
        },
        {
          title: "Reddit",
          url: "https://www.reddit.com",
          tags: ["social", "news"],
        },
        {
          title: "Instagram",
          url: "https://www.instagram.com",
          tags: ["social", "photos"],
        },
      ],
    },
  ],
  other: [
    {
      title: "Sports",
      children: [
        {
          title: "News & Scores",
          children: [
            {
              title: "ESPN",
              url: "https://www.espn.com",
              tags: ["sports", "news"],
            },
            {
              title: "Bleacher Report",
              url: "https://bleacherreport.com",
              tags: ["sports", "news"],
            },
          ],
        },
        {
          title: "Golf",
          children: [
            {
              title: "PGA Tour",
              url: "https://www.pgatour.com",
              tags: ["sports", "golf"],
            },
            {
              title: "Golf Digest",
              url: "https://www.golfdigest.com",
              tags: ["sports", "golf"],
            },
            {
              title: "Golf WRX",
              url: "https://www.golfwrx.com",
              tags: ["sports", "golf", "equipment"],
            },
          ],
        },
      ],
    },
    {
      title: "Web Development",
      children: [
        {
          title: "Documentation",
          children: [
            {
              title: "MDN Web Docs",
              url: "https://developer.mozilla.org",
              tags: ["dev", "docs"],
            },
            {
              title: "React Documentation",
              url: "https://react.dev",
              tags: ["dev", "docs", "react"],
            },
            {
              title: "TypeScript Docs",
              url: "https://www.typescriptlang.org/docs",
              tags: ["dev", "docs", "typescript"],
            },
          ],
        },
        {
          title: "Tools",
          children: [
            {
              title: "GitHub",
              url: "https://github.com",
              tags: ["dev", "tools"],
            },
            {
              title: "CodeSandbox",
              url: "https://codesandbox.io",
              tags: ["dev", "tools"],
            },
          ],
        },
      ],
    },
    {
      title: "Fitness",
      children: [
        {
          title: "Workout Resources",
          children: [
            {
              title: "Bodybuilding.com",
              url: "https://www.bodybuilding.com",
              tags: ["fitness", "workouts"],
            },
            {
              title: "MyFitnessPal",
              url: "https://www.myfitnesspal.com",
              tags: ["fitness", "nutrition"],
            },
          ],
        },
        {
          title: "Exercise Guides",
          children: [
            {
              title: "ExRx",
              url: "https://exrx.net",
              tags: ["fitness", "exercises"],
            },
            {
              title: "Muscle & Strength",
              url: "https://www.muscleandstrength.com",
              tags: ["fitness", "workouts"],
            },
          ],
        },
      ],
    },
  ],
};


export default defineBackground(async () => {
  // Function to get domain from URL
  function getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  // Function to recursively create bookmarks
async function createBookmarkStructure(
  items: BookmarkItem[],
  parentId: string | undefined = undefined,
  tagsMap: Record<number, { tags: string[] }> = {},
) {
  console.log("Creating bookmarks for:", { items, parentId });

  for (const item of items) {
    try {
      const bookmarkNode = await browser.bookmarks.create({
        parentId,
        title: item.title,
        url: item.url,
      });
      console.log("Created bookmark:", {
        title: item.title,
        id: bookmarkNode.id,
      });

      if (item.tags) {
        tagsMap[parseInt(bookmarkNode.id)] = { tags: item.tags };
      }

      if (item.children) {
        await createBookmarkStructure(item.children, bookmarkNode.id, tagsMap);
      }
    } catch (error) {
      console.error("Error creating bookmark:", { item, error });
    }
  }
  return tagsMap;
}


// Function to create default bookmarks
async function createDefaultBookmarks() {
  try {
    console.log("Starting default bookmarks creation...");

    // Check if default bookmarks have been created
    const existingBookmarks = await browser.bookmarks.search({
      title: "Quick Links",
    });
    console.log("Existing Quick Links folders:", existingBookmarks);

    if (existingBookmarks.length === 0) {
      console.log(
        "No existing Quick Links folder found, creating bookmarks...",
      );

      // Get bookmarks bar folder
      const bookmarksBar = await browser.bookmarks.getTree();
      const bookmarksBarId = bookmarksBar[0].children?.[0].id; // Get the bookmarks bar ID

      console.log("Bookmarks bar ID:", bookmarksBarId);

      if (!bookmarksBarId) {
        throw new Error("Could not find bookmarks bar");
      }

      // Create bookmarks in bookmarks bar
      const barTagsMap = await createBookmarkStructure(
        BOOKMARK_STRUCTURE.bookmarksBar,
        bookmarksBarId,
      );
      console.log("Created bookmarks bar items:", barTagsMap);

      // Create other bookmarks structure in Other Bookmarks
      const otherBookmarksId = bookmarksBar[0].children?.[1].id; // Get Other Bookmarks folder ID
      const otherTagsMap = await createBookmarkStructure(
        BOOKMARK_STRUCTURE.other,
        otherBookmarksId,
      );
      console.log("Created other bookmarks:", otherTagsMap);

      // Combine all tags
      const allTagsMap = { ...barTagsMap, ...otherTagsMap };

      // Store tags for the bookmarks
      const bookmarksData = (await browser.storage.local.get("tabsData")) || {
        tabsData: {},
      };
      const newBookmarksData = { ...bookmarksData.tabsData, ...allTagsMap };

      await browser.storage.local.set({ tabsData: newBookmarksData });
      console.log("Successfully stored bookmark tags");
    } else {
      console.log(
        "Quick Links folder already exists, skipping bookmark creation",
      );
    }
  } catch (error) {
    console.error("Error creating default bookmarks:", error);
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
  browser.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    if (message.action === 'getTabs') {
      // For getTabs, we need to handle it specially to return the tabs
      getUpdatedTabs()
        .then(tabs => {
          console.log("Sending tabs back to content script:", tabs);
          sendResponse(tabs);
        })
        .catch(error => {
          console.error('Error getting tabs:', error);
          sendResponse([]);
        });
      
      // Return true to indicate we'll respond asynchronously
      return true;
    }
    
    // Handle other messages
    try {
      switch (message.action) {
        case 'openDialog':
          openDialog();
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
    
    // Return false for synchronous responses or messages without responses
    return false;
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
    // Create default bookmarks when extension loads
    await createDefaultBookmarks();

  // Initial setup
  console.log('Background script starting...');
});
