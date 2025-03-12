import "./style.css";

import App from "./tabs-modal/App";
import React from "react";
import ReactDOM from "react-dom/client";
import { createShadowRootUi } from "wxt/client";

// Define the Tab interface
interface Tab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  tags?: string[];
  labels?: string[];
}

// Define props for the App component
interface AppProps {
  initialTabs: Tab[];
}

// Define interfaces for bookmark structure
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

// export default defineContentScript({
//   matches: ["http://localhost/*"],
//   main(ctx) {
//     console.log(ctx);
// browser.tabs.onActivated.addListener(async (message) => {
//   console.log(message);
//   await browser.runtime.sendMessage({ hello: "world" });
// });

//     browser.runtime.onMessage.addListener(async (message) => {
//       console.log("Content script received message:", message);
//       return Math.random();
//     });
//   },
// });
export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    // Create default bookmarks when extension loads
    await createDefaultBookmarks();

    // Function to fetch tabs from the background script
    const fetchTabs = async (): Promise<Tab[]> => {
      try {
        // Request tabs from the background script
        const tabs = await browser.runtime.sendMessage({ action: "getTabs" });
        return tabs || [];
      } catch (error) {
        console.error("Error fetching tabs:", error);
        return [];
      }
    };

    // Initial tabs data
    const initialTabs = await fetchTabs();

    const ui = await createShadowRootUi(ctx, {
      name: "wxt-react-example",
      position: "inline",
      anchor: "body",
      append: "first",
      onMount: (container) => {
        // Don't mount react app directly on <body>
        const wrapper = document.createElement("div");
        container.append(wrapper);

        const root = ReactDOM.createRoot(wrapper);
        // Pass the tabs data to the App component as props
        root.render(React.createElement(App, { initialTabs } as AppProps));
        return { root, wrapper };
      },
      onRemove: (elements) => {
        elements?.root.unmount();
        elements?.wrapper.remove();
      },
    });

    ui.mount();

    // Listen for messages from the background script
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.action === "tabsUpdated" && message.tabs) {
        // Use a custom event to communicate with the React app
        document.dispatchEvent(
          new CustomEvent("tabs-updated", {
            detail: { tabs: message.tabs },
          }),
        );
      }
      return true; // Required to indicate we've handled the message
    });
  },
});
