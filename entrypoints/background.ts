export default defineBackground(() => {
  // Function to fetch all browser tabs
  const fetchTabs = async () => {
    try {
      const allTabs = await browser.tabs.query({});
      return allTabs.map((tab) => ({
        id: tab.id || 0,
        title: tab.title || "Untitled",
        url: tab.url || "",
        favIconUrl: tab.favIconUrl,
        active: tab.active || false,
        tags: [],
        labels: [],
      }));
    } catch (error) {
      console.error("Error fetching tabs:", error);
      return [];
    }
  };

  // Listen for messages from content script
  browser.runtime.onMessage.addListener(async (message) => {
    if (message.action === "getTabs") {
      const tabs = await fetchTabs();
      return tabs; // This will be sent back to the content script
    }
    return false;
  });

  // Listen for tab updates to notify content scripts
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      const tabs = await fetchTabs();
      // Send updated tabs to all content scripts
      const allTabs = await browser.tabs.query({});
      allTabs.forEach((tab) => {
        if (tab.id) {
          try {
            browser.tabs.sendMessage(tab.id, { action: "tabsUpdated", tabs });
          } catch {
            // Content script might not be ready yet, which is fine
          }
        }
      });
    }
  });

  // Listen for tab activation changes
  browser.tabs.onActivated.addListener(async () => {
    const tabs = await fetchTabs();
    // Send updated tabs to all content scripts
    const allTabs = await browser.tabs.query({});
    allTabs.forEach((tab) => {
      if (tab.id) {
        try {
          browser.tabs.sendMessage(tab.id, { action: "tabsUpdated", tabs });
        } catch {
          // Content script might not be ready yet, which is fine
        }
      }
    });
  });

  // For debugging: log when extension is installed or updated
  browser.runtime.onInstalled.addListener((details) => {
    console.log("Extension installed/updated:", details.reason);
  });
});
