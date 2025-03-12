import "uno.css";
import "./style.css";

import {
  AppProps,
  SuspensionRule,
  SuspensionSettings,
  Tab,
  TagStats,
} from "./types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@tag/ui";
import React, {
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { TabDialog } from '../../src/components/TabDialog';

// Define the browser API for TypeScript
declare namespace browser {
  namespace bookmarks {
    interface BookmarkTreeNode {
      id: string;
      parentId?: string;
      index?: number;
      url?: string;
      title: string;
      dateAdded?: number;
      dateGroupModified?: number;
      type?: "bookmark" | "folder" | "separator";
      children?: BookmarkTreeNode[];
    }

    function getTree(): Promise<BookmarkTreeNode[]>;
  }

  namespace tabs {
    interface UpdateProperties {
      active?: boolean;
      url?: string;
    }

    function update(
      tabId: number,
      updateProperties: UpdateProperties,
    ): Promise<Tab>;
    function create(createProperties: { url: string }): Promise<Tab>;
    function query(queryInfo?: {
      active?: boolean;
      currentWindow?: boolean;
    }): Promise<Tab[]>;
    function move(
      tabId: number,
      moveProperties: { index: number },
    ): Promise<Tab>;
    function get(tabId: number): Promise<Tab>;
  }

  namespace runtime {
    function sendMessage(message: Record<string, unknown>): Promise<unknown>;
  }

  namespace storage {
    interface StorageArea {
      get(keys: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    }
    const local: StorageArea;
  }

  namespace processes {
    interface ProcessInfo {
      type: string;
      jsHeapSizeUsed?: number;
      privateMemory?: number;
    }
    function getProcessInfo(
      tabIds: number[],
    ): Promise<Record<string, ProcessInfo>>;
  }
}

interface TagFilter {
  tag: string;
  exclude: boolean;
}

interface TagSuggestion {
  tag: string;
  count: number;
  lastUsed: number;
}

// Add new type for sort options
type SortOption =
  | "memory"
  | "lastActive"
  | "lastOpened"
  | "title"
  | "domain"
  | "url"
  | "none";

// Add memory formatting function
const formatMemorySize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
};

const DEFAULT_SUSPENSION_SETTINGS: SuspensionSettings = {
  enabled: true,
  defaultDelay: 30, // 30 minutes
  memoryThreshold: 500 * 1024 * 1024, // 500MB
  fasterDelay: 5, // 5 minutes
  rules: [],
};

const App: React.FC<AppProps> = ({ initialTabs = [], initialBookmarks = [] }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [bookmarks, setBookmarks] = useState<Tab[]>(initialBookmarks);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);
  const [newTag, setNewTag] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [editingTab, setEditingTab] = useState<Tab | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [tagFilters, setTagFilters] = useState<TagFilter[]>([]);
  const [focusedTabIndex, setFocusedTabIndex] = useState<number>(-1);
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tagStats, setTagStats] = useState<Record<string, TagStats>>({});
  const [sortOption, setSortOption] = useState<SortOption>("none");
  const [suspensionSettings, setSuspensionSettings] =
    useState<SuspensionSettings>(DEFAULT_SUSPENSION_SETTINGS);
  const [showSuspensionSettings, setShowSuspensionSettings] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const allItems = [...tabs, ...(showBookmarks ? bookmarks : [])];

  // Add sorting function
  const sortItems = (items: Tab[]): Tab[] => {
    if (sortOption === "none") return items;

    return [...items].sort((a, b) => {
      // Move declarations outside case blocks
      let aMemory: number,
        bMemory: number,
        aTime: number,
        bTime: number,
        aTitle: string,
        bTitle: string,
        aDomain: string,
        bDomain: string;

      switch (sortOption) {
        case "memory":
          aMemory = a.memoryUsage?.privateMemory || 0;
          bMemory = b.memoryUsage?.privateMemory || 0;
          return bMemory - aMemory; // Sort by memory usage (highest first)

        case "lastActive":
          aTime = a.lastActiveTimestamp || 0;
          bTime = b.lastActiveTimestamp || 0;
          return bTime - aTime; // Sort by last active (most recent first)

        case "lastOpened":
          // For bookmarks, use lastActiveTimestamp, for tabs use both active state and lastActiveTimestamp
          aTime = a.isBookmark
            ? a.lastActiveTimestamp || 0
            : a.active
              ? Date.now()
              : a.lastActiveTimestamp || 0;
          bTime = b.isBookmark
            ? b.lastActiveTimestamp || 0
            : b.active
              ? Date.now()
              : b.lastActiveTimestamp || 0;
          return bTime - aTime; // Sort by last opened (most recent first)

        case "domain":
          try {
            aDomain = new URL(a.originalUrl || a.url).hostname;
            bDomain = new URL(b.originalUrl || b.url).hostname;
            return aDomain.localeCompare(bDomain);
          } catch {
            return 0;
          }

        case "url":
          return (a.originalUrl || a.url).localeCompare(b.originalUrl || b.url);

        case "title":
          aTitle = (a.customTitle || a.title).toLowerCase();
          bTitle = (b.customTitle || b.title).toLowerCase();
          return aTitle.localeCompare(bTitle);

        default:
          return 0;
      }
    });
  };

  // Update the filtered items to include sorting
  const filteredItems = sortItems(
    allItems.filter((item) => {
      const query = searchQuery.toLowerCase();
      const title = item.customTitle || item.title;
      const description = item.description || "";

      // Check if the item matches the search query
      const matchesQuery =
        title.toLowerCase().includes(query) ||
        item.url.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
        item.labels?.some((label) => label.toLowerCase().includes(query));

      // Check if the item matches all tag filters
      const matchesTagFilters = tagFilters.every((filter) => {
        const hasTag = item.tags?.includes(filter.tag) || false;
        return filter.exclude ? !hasTag : hasTag;
      });

      return matchesQuery && matchesTagFilters;
    }),
  );

  // Add memory statistics calculation
  const memoryStats = React.useMemo(() => {
    const stats = {
      totalMemory: 0,
      totalJsHeap: 0,
      averageMemory: 0,
      highestMemory: 0,
      highestMemoryTab: null as Tab | null,
      tabCount: 0,
    };

    tabs.forEach((tab) => {
      if (tab.memoryUsage?.privateMemory) {
        stats.totalMemory += tab.memoryUsage.privateMemory;
        stats.tabCount++;

        if (tab.memoryUsage.privateMemory > stats.highestMemory) {
          stats.highestMemory = tab.memoryUsage.privateMemory;
          stats.highestMemoryTab = tab;
        }
      }
      if (tab.memoryUsage?.jsHeapSizeUsed) {
        stats.totalJsHeap += tab.memoryUsage.jsHeapSizeUsed;
      }
    });

    stats.averageMemory = stats.tabCount
      ? stats.totalMemory / stats.tabCount
      : 0;
    return stats;
  }, [tabs]);

  // Add memory warning threshold (500MB)
  const MEMORY_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB in bytes

  // Add memory warning component
  const MemoryWarning = ({ tab }: { tab: Tab }) => {
    if (
      !tab.memoryUsage?.privateMemory ||
      tab.memoryUsage.privateMemory < MEMORY_WARNING_THRESHOLD
    ) {
      return null;
    }

    return (
      <div className="absolute top-0 right-0 p-1">
        <span className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          High Memory Usage
        </span>
      </div>
    );
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsVisible(prev => !prev);
        setIsOpen(prev => !prev); // Also toggle the Dialog's open state
      }

      // Close modal on Escape key
      if (e.key === "Escape" && isVisible) {
        setIsVisible(false);
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  // Listen for tab updates from the content script
  useEffect(() => {
    const handleTabsUpdated = (event: CustomEvent<{ tabs: Tab[] }>) => {
      // Preserve tags when updating tabs
      const updatedTabs = event.detail.tabs.map((newTab) => {
        const existingTab = tabs.find((t) => t.id === newTab.id);
        return {
          ...newTab,
          tags: existingTab?.tags || [],
          customTitle: existingTab?.customTitle,
          description: existingTab?.description,
        };
      });
      setTabs(updatedTabs);

      // Update all tags list
      updateAllTagsList([...updatedTabs, ...bookmarks]);
    };

    // TypeScript requires this cast for CustomEvent
    document.addEventListener(
      "tabs-updated",
      handleTabsUpdated as EventListener,
    );

    return () => {
      document.removeEventListener(
        "tabs-updated",
        handleTabsUpdated as EventListener,
      );
    };
  }, [tabs, bookmarks]);

  useEffect(() => {
    // If we don't have initial tabs, fetch them when modal becomes visible
    if (isVisible) {
      if (tabs.length === 0) {
        fetchTabs();
      }
      if (bookmarks.length === 0 && showBookmarks) {
        fetchBookmarks();
      }
    }

    // Update all tags list when tabs change
    updateAllTagsList([...tabs, ...bookmarks]);
  }, [isVisible, tabs.length, bookmarks.length, showBookmarks]);

  const updateAllTagsList = (tabsArray: Tab[]) => {
    const tagsSet = new Set<string>();
    tabsArray.forEach((tab) => {
      tab.tags?.forEach((tag) => tagsSet.add(tag));
    });
    setAllTags(Array.from(tagsSet).sort());
  };

  const fetchTabs = async () => {
    try {
      const response = await browser.runtime.sendMessage({ action: "getTabs" });
      const allTabs = response as Tab[];
      const tabsWithTags = allTabs.map((tab) => ({
        ...tab,
        tags: [],
        labels: [],
        customTitle: null,
        description: null,
        isBookmark: false,
      }));
      setTabs(tabsWithTags);
    } catch (error) {
      console.error("Error fetching tabs:", error);
    }
  };

  // Add function to generate bookmark URL
  const generateBookmarkUrl = (originalUrl: string): string => {
    const hash = Math.random().toString(36).substring(2, 15);
    return `${window.location.origin}/bookmark/${hash}/?bookmark=${encodeURIComponent(originalUrl)}`;
  };

  // Update bookmark creation function
  const createBookmark = async (tab: Tab, tags: string[] = []) => {
    try {
      const bookmarkUrl = generateBookmarkUrl(tab.url);
      const bookmarkNode = await browser.bookmarks.create({
        title: tab.customTitle || tab.title,
        url: bookmarkUrl,
      });

      const newBookmark: Tab = {
        id: parseInt(bookmarkNode.id),
        title: tab.customTitle || tab.title,
        url: bookmarkUrl,
        originalUrl: tab.url,
        favIconUrl: tab.favIconUrl,
        active: false,
        tags: [...(tab.tags || []), ...tags],
        isBookmark: true,
        customTitle: tab.customTitle,
        description: tab.description,
        lastActiveTimestamp: Date.now(),
      };

      setBookmarks((prev) => [...prev, newBookmark]);
      saveTabsData();
    } catch (error) {
      console.error("Error creating bookmark:", error);
    }
  };

  // Add function to extract original URL from bookmark
  const getOriginalUrlFromBookmark = (url: string): string | null => {
    try {
      const bookmarkParam = new URL(url).searchParams.get("bookmark");
      return bookmarkParam ? decodeURIComponent(bookmarkParam) : null;
    } catch {
      return null;
    }
  };

  // Update fetchBookmarks function to handle the new bookmark format
  const fetchBookmarks = async () => {
    try {
      const bookmarkTree = await browser.bookmarks.getTree();
      const flattenedBookmarks: Tab[] = [];

      // Recursive function to flatten bookmark tree
      const flattenBookmarks = async (
        nodes: browser.bookmarks.BookmarkTreeNode[],
      ) => {
        for (const node of nodes) {
          if (node.url) {
            const originalUrl = getOriginalUrlFromBookmark(node.url);
            if (originalUrl) {
              // It's our special bookmark format
              try {
                // Fetch favicon for the original URL
                const response = await fetch(
                  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(originalUrl)}`,
                );
                const favIconUrl = response.ok ? response.url : undefined;

                flattenedBookmarks.push({
                  id: parseInt(node.id),
                  title: node.title,
                  url: node.url,
                  originalUrl,
                  favIconUrl,
                  active: false,
                  tags: [],
                  labels: [],
                  customTitle: null,
                  description: null,
                  isBookmark: true,
                });
              } catch (error) {
                console.error("Error fetching favicon:", error);
              }
            }
          }

          if (node.children) {
            await flattenBookmarks(node.children);
          }
        }
      };

      await flattenBookmarks(bookmarkTree);
      setBookmarks(flattenedBookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
    }
  };

  const updateTimestamps = (itemId: number, tags: string[] = []) => {
    const now = Date.now();

    // Update item timestamp
    const updatedTabs = tabs.map((tab) =>
      tab.id === itemId ? { ...tab, lastActiveTimestamp: now } : tab,
    );
    setTabs(updatedTabs);

    const updatedBookmarks = bookmarks.map((bookmark) =>
      bookmark.id === itemId
        ? { ...bookmark, lastActiveTimestamp: now }
        : bookmark,
    );
    setBookmarks(updatedBookmarks);

    // Update tag timestamps
    const updatedTagStats = { ...tagStats };
    tags.forEach((tag) => {
      if (!updatedTagStats[tag]) {
        updatedTagStats[tag] = {
          tag,
          lastActiveTimestamp: now,
          itemCount: 1,
          items: [],
        };
      } else {
        updatedTagStats[tag].lastActiveTimestamp = now;
        // Update or add item in tag's items list
        const itemIndex = updatedTagStats[tag].items.findIndex(
          (item) => item.id === itemId,
        );
        const item = [...updatedTabs, ...updatedBookmarks].find(
          (i) => i.id === itemId,
        );
        if (item) {
          if (itemIndex >= 0) {
            updatedTagStats[tag].items[itemIndex].lastActiveTimestamp = now;
          } else {
            updatedTagStats[tag].items.push({
              id: itemId,
              title: item.customTitle || item.title,
              lastActiveTimestamp: now,
            });
          }
        }
      }
    });
    setTagStats(updatedTagStats);

    // Save to storage
    saveTabsData();
  };

  const handleTabClick = async (tab: Tab) => {
    if (tab.suspended) {
      await restoreTab(tab);
    } else {
      try {
        await browser.tabs.update(tab.id, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
      } catch (error) {
        console.error("Error activating tab:", error);
      }
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim() || selectedTabIds.length === 0) return;

    // Add tag to all selected tabs
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (selectedTabIds.includes(tab.id)) {
          const updatedTags = [...(tab.tags || [])];
          if (!updatedTags.includes(newTag.trim())) {
            updatedTags.push(newTag.trim());
          }
          return { ...tab, tags: updatedTags };
        }
        return tab;
      }),
    );

    // Add tag to selected bookmarks
    setBookmarks((prevBookmarks) =>
      prevBookmarks.map((bookmark) => {
        if (selectedTabIds.includes(bookmark.id)) {
          const updatedTags = [...(bookmark.tags || [])];
          if (!updatedTags.includes(newTag.trim())) {
            updatedTags.push(newTag.trim());
          }
          return { ...bookmark, tags: updatedTags };
        }
        return bookmark;
      }),
    );

    setNewTag("");
    updateAllTagsList([...tabs, ...bookmarks]);

    // Save tags to storage
    saveTabsData();
  };

  const handleRemoveTag = (tabId: number, tagToRemove: string) => {
    // Check if it's a tab or bookmark
    const isBookmark = bookmarks.some((b) => b.id === tabId);

    if (isBookmark) {
      setBookmarks((prevBookmarks) =>
        prevBookmarks.map((bookmark) => {
          if (bookmark.id === tabId) {
            return {
              ...bookmark,
              tags: (bookmark.tags || []).filter((tag) => tag !== tagToRemove),
            };
          }
          return bookmark;
        }),
      );
    } else {
      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          if (tab.id === tabId) {
            return {
              ...tab,
              tags: (tab.tags || []).filter((tag) => tag !== tagToRemove),
            };
          }
          return tab;
        }),
      );
    }

    // If we're in edit mode, update the editing tab state as well
    if (editingTab && editingTab.id === tabId) {
      setEditingTab((prevTab) => {
        if (!prevTab) return null;
        return {
          ...prevTab,
          tags: (prevTab.tags || []).filter((tag) => tag !== tagToRemove),
        };
      });
    }

    // Save tags to storage
    saveTabsData();
  };

  const handleEditTab = (tab: Tab) => {
    setEditingTab(tab);
    setEditedTitle(tab.customTitle || tab.title);
    setEditedDescription(tab.description || "");
  };

  const handleSaveEdit = () => {
    if (!editingTab) return;

    if (editingTab.isBookmark) {
      setBookmarks((prevBookmarks) =>
        prevBookmarks.map((bookmark) => {
          if (bookmark.id === editingTab.id) {
            return {
              ...bookmark,
              customTitle: editedTitle.trim() || null,
              description: editedDescription.trim() || null,
            };
          }
          return bookmark;
        }),
      );
    } else {
      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          if (tab.id === editingTab.id) {
            return {
              ...tab,
              customTitle: editedTitle.trim() || null,
              description: editedDescription.trim() || null,
            };
          }
          return tab;
        }),
      );
    }

    setEditingTab(null);
    saveTabsData();
  };

  const saveTabsData = async () => {
    try {
      await browser.storage.local.set({
        tabs: tabs.map((tab) => ({
          ...tab,
          tags: tab.tags || [],
          customTitle: tab.customTitle || null,
          description: tab.description || null,
        })),
        bookmarks: bookmarks.map((bookmark) => ({
          ...bookmark,
          tags: bookmark.tags || [],
          customTitle: bookmark.customTitle || null,
          description: bookmark.description || null,
        })),
        suspensionSettings,
      });
    } catch (error) {
      console.error("Error saving tabs data:", error);
    }
  };

  // Add effect to load suspension settings from storage
  useEffect(() => {
    const loadSuspensionSettings = async () => {
      try {
        const data = await browser.storage.local.get("suspensionSettings");
        if (data.suspensionSettings) {
          setSuspensionSettings(data.suspensionSettings);
        }
      } catch (error) {
        console.error("Error loading suspension settings:", error);
      }
    };

    loadSuspensionSettings();
  }, []);

  const loadTabsData = async () => {
    try {
      const data = await browser.storage.local.get([
        "tabs",
        "bookmarks",
        "suspensionSettings",
      ]);

      if (data.tabs) {
        setTabs((prevTabs) =>
          prevTabs.map((tab) => {
            const savedTab = data.tabs.find((t: Tab) => t.id === tab.id);
            return savedTab
              ? { ...tab, ...savedTab }
              : { ...tab, tags: [], customTitle: null, description: null };
          }),
        );
      }

      if (data.bookmarks) {
        setBookmarks(data.bookmarks);
      }

      if (data.suspensionSettings) {
        setSuspensionSettings(data.suspensionSettings);
      }

      updateAllTagsList([...tabs, ...bookmarks]);
    } catch (error) {
      console.error("Error loading tabs data:", error);
    }
  };

  // Load tags when tabs are first loaded
  useEffect(() => {
    if (tabs.length > 0 || bookmarks.length > 0) {
      loadTabsData();
    }
  }, [initialTabs]);

  const handleTagClick = (tag: string, exclude = false) => {
    // If the tag is already in the filters, remove it
    if (tagFilters.some((filter) => filter.tag === tag)) {
      setTagFilters(tagFilters.filter((filter) => filter.tag !== tag));
    } else {
      // Otherwise add it to the filters
      setTagFilters([...tagFilters, { tag, exclude }]);
    }
  };

  const handleSearchInputKeyDown = (
    e: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    // If Tab key is pressed and there's text in the search box
    if (e.key === "Tab" && searchQuery.trim()) {
      e.preventDefault(); // Prevent default tab behavior

      // Check if the search query matches any existing tag
      const matchingTag = allTags.find((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase()),
      );

      if (matchingTag) {
        // Add the tag to filters
        handleTagClick(matchingTag);
        setSearchQuery(""); // Clear the search query
      }
    }
  };

  const handleApplyTagToAll = () => {
    if (!newTag.trim() || filteredItems.length === 0) return;

    // Add tag to all filtered tabs
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        // Only apply to filtered tabs
        if (
          filteredItems.some(
            (filteredItem) =>
              filteredItem.id === tab.id && !filteredItem.isBookmark,
          )
        ) {
          const updatedTags = [...(tab.tags || [])];
          if (!updatedTags.includes(newTag.trim())) {
            updatedTags.push(newTag.trim());
          }
          return { ...tab, tags: updatedTags };
        }
        return tab;
      }),
    );

    // Add tag to all filtered bookmarks
    setBookmarks((prevBookmarks) =>
      prevBookmarks.map((bookmark) => {
        // Only apply to filtered bookmarks
        if (
          filteredItems.some(
            (filteredItem) =>
              filteredItem.id === bookmark.id && filteredItem.isBookmark,
          )
        ) {
          const updatedTags = [...(bookmark.tags || [])];
          if (!updatedTags.includes(newTag.trim())) {
            updatedTags.push(newTag.trim());
          }
          return { ...bookmark, tags: updatedTags };
        }
        return bookmark;
      }),
    );

    setNewTag("");
    updateAllTagsList([...tabs, ...bookmarks]);
    saveTabsData();
  };

  const isWxtDevUrl = (url: string): boolean => {
    return url.startsWith("http://localhost:") && url.includes("chrome-mv3");
  };

  const handleOpenAllFiltered = async () => {
    // Get all WXT development URLs first
    const wxtDevUrls = filteredItems
      .filter((item) => isWxtDevUrl(item.url))
      .map((item) => item.url);

    // Open each filtered item in a new tab
    for (const item of filteredItems) {
      try {
        // Skip WXT dev URLs for now
        if (!isWxtDevUrl(item.url)) {
          await browser.tabs.create({ url: item.url });
        }
      } catch (error) {
        console.error(`Error opening tab with URL ${item.url}:`, error);
      }
    }

    // Now open WXT dev URLs last to ensure they're on top
    for (const url of wxtDevUrls) {
      try {
        await browser.tabs.create({ url });
      } catch (error) {
        console.error(`Error opening WXT dev URL ${url}:`, error);
      }
    }

    // Close the modal after opening all tabs
    setIsVisible(false);
  };

  const handleSelectAll = () => {
    setSelectedTabIds(filteredItems.map((item) => item.id));
  };

  const handleDeselectAll = () => {
    setSelectedTabIds([]);
  };

  const handleToggleBookmarks = () => {
    setShowBookmarks((prev) => !prev);
  };

  const handleRemoveTagFilter = (tag: string) => {
    setTagFilters(tagFilters.filter((filter) => filter.tag !== tag));
  };

  // Add this new function to handle tab reordering
  const handleReorderTabs = async (startIndex: number, endIndex: number) => {
    const newTabs = [...filteredItems];
    const [movedTab] = newTabs.splice(startIndex, 1);
    newTabs.splice(endIndex, 0, movedTab);

    // Update the tabs in the browser
    if (!isWxtDevUrl(movedTab.url)) {
      const allTabs = await browser.tabs.query({});
      const tabIds = newTabs.map((tab) => tab.id);

      for (let i = 0; i < tabIds.length; i++) {
        await browser.tabs.move(tabIds[i], { index: i });
      }
    }
  };

  // Add this function to get tag suggestions
  const getTagSuggestions = (input: string): TagSuggestion[] => {
    if (!input.trim()) return [];

    // Get all tags with their usage count and last used timestamp
    const tagStats = allTags.reduce(
      (stats, tag) => {
        const count = [...tabs, ...bookmarks].filter((item) =>
          item.tags?.includes(tag),
        ).length;

        const lastUsed = Math.max(
          ...tabs
            .concat(bookmarks)
            .filter((item) => item.tags?.includes(tag))
            .map((item) => item.id),
        );

        stats[tag] = { count, lastUsed };
        return stats;
      },
      {} as Record<string, { count: number; lastUsed: number }>,
    );

    // Filter and sort suggestions
    return Object.entries(tagStats)
      .filter(([tag]) => tag.toLowerCase().includes(input.toLowerCase()))
      .map(([tag, stats]) => ({
        tag,
        count: stats.count,
        lastUsed: stats.lastUsed,
      }))
      .sort((a, b) => {
        // First, prioritize exact matches
        const aStartsWith = a.tag.toLowerCase().startsWith(input.toLowerCase());
        const bStartsWith = b.tag.toLowerCase().startsWith(input.toLowerCase());
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // Then sort by most recently used
        if (a.lastUsed !== b.lastUsed) {
          return b.lastUsed - a.lastUsed;
        }

        // Finally, sort by usage count
        return b.count - a.count;
      })
      .slice(0, 5); // Limit to 5 suggestions
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewTag(value);
    const suggestions = getTagSuggestions(value);
    setTagSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < tagSuggestions.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > -1 ? prev - 1 : -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          setNewTag(tagSuggestions[selectedSuggestionIndex].tag);
          setShowSuggestions(false);
        } else {
          if (selectedTabIds.length > 0) {
            handleAddTag();
          } else {
            handleApplyTagToAll();
          }
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    } else if (e.key === "Enter") {
      if (selectedTabIds.length > 0) {
        handleAddTag();
      } else {
        handleApplyTagToAll();
      }
    }
  };

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add function to format time since last active
  const getTimeSince = (timestamp?: number): string => {
    if (!timestamp) return "Never";

    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  };

  // Add function to fetch memory usage
  const updateMemoryUsage = async () => {
    try {
      // Only fetch memory for non-bookmark tabs
      const tabIds = tabs.filter((tab) => !tab.isBookmark).map((tab) => tab.id);
      if (tabIds.length === 0) return;

      const processInfo = await browser.processes.getProcessInfo(tabIds);

      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          const info = processInfo[tab.id.toString()];
          if (!info) return tab;

          return {
            ...tab,
            memoryUsage: {
              jsHeapSizeUsed: info.jsHeapSizeUsed,
              privateMemory: info.privateMemory,
            },
          };
        }),
      );
    } catch (error) {
      console.error("Error fetching memory usage:", error);
    }
  };

  // Add effect to periodically update memory usage
  useEffect(() => {
    if (!isVisible) return;

    // Update immediately when becoming visible
    updateMemoryUsage();

    // Then update every 5 seconds
    const interval = setInterval(updateMemoryUsage, 5000);

    return () => clearInterval(interval);
  }, [isVisible, tabs.length]);

  // Add function to check if a tab should be suspended
  const shouldSuspendTab = (tab: Tab): boolean => {
    if (
      !suspensionSettings.enabled ||
      tab.isBookmark ||
      tab.active ||
      tab.suspended
    ) {
      return false;
    }

    // Check domain/path rules
    const url = new URL(tab.url);
    const domain = url.hostname;
    const path = url.pathname;

    // Check for never-suspend rules
    const neverSuspendRule = suspensionSettings.rules.find((rule) => {
      if (rule.action !== "never") return false;
      if (rule.expiresAt && Date.now() > rule.expiresAt) return false;
      if (rule.type === "domain") return domain.includes(rule.value);
      return path.startsWith(rule.value);
    });
    if (neverSuspendRule) return false;

    // Get the applicable delay
    let delay = suspensionSettings.defaultDelay;

    // Check for faster-suspend rules
    const fasterSuspendRule = suspensionSettings.rules.find((rule) => {
      if (rule.action !== "faster") return false;
      if (rule.expiresAt && Date.now() > rule.expiresAt) return false;
      if (rule.type === "domain") return domain.includes(rule.value);
      return path.startsWith(rule.value);
    });

    // Use faster delay if rule matches or memory threshold is exceeded
    if (
      fasterSuspendRule ||
      (tab.memoryUsage?.privateMemory &&
        tab.memoryUsage.privateMemory >= suspensionSettings.memoryThreshold)
    ) {
      delay = suspensionSettings.fasterDelay;
    }

    // Check if enough time has passed since last activity
    const timeSinceActive = Date.now() - (tab.lastActiveTimestamp || 0);
    return timeSinceActive >= delay * 60 * 1000; // Convert minutes to milliseconds
  };

  // Add function to suspend a tab
  const suspendTab = async (tab: Tab) => {
    if (tab.isBookmark || tab.suspended) return;

    try {
      // Store the original URL and mark as suspended
      const updatedTab = {
        ...tab,
        suspended: true,
        suspendedUrl: tab.url,
        lastSuspendedTimestamp: Date.now(),
        url: `about:blank#suspended=${encodeURIComponent(tab.url)}`,
      };

      // Update the tab in the browser
      await browser.tabs.update(tab.id, { url: updatedTab.url });

      // Update local state
      setTabs((prevTabs) =>
        prevTabs.map((t) => (t.id === tab.id ? updatedTab : t)),
      );

      // Save to storage
      saveTabsData();
    } catch (error) {
      console.error("Error suspending tab:", error);
    }
  };

  // Add function to restore a suspended tab
  const restoreTab = async (tab: Tab) => {
    if (!tab.suspended || !tab.suspendedUrl) return;

    try {
      const updatedTab = {
        ...tab,
        suspended: false,
        url: tab.suspendedUrl,
        suspendedUrl: undefined,
        lastSuspendedTimestamp: undefined,
      };

      // Update the tab in the browser
      await browser.tabs.update(tab.id, { url: updatedTab.url });

      // Update local state
      setTabs((prevTabs) =>
        prevTabs.map((t) => (t.id === tab.id ? updatedTab : t)),
      );

      // Save to storage
      saveTabsData();
    } catch (error) {
      console.error("Error restoring tab:", error);
    }
  };

  // Add effect to periodically check for tabs that should be suspended
  useEffect(() => {
    if (!suspensionSettings.enabled) return;

    const checkForSuspension = () => {
      tabs.forEach((tab) => {
        if (shouldSuspendTab(tab)) {
          suspendTab(tab);
        }
      });
    };

    // Check immediately
    checkForSuspension();

    // Then check every minute
    const interval = setInterval(checkForSuspension, 60 * 1000);

    return () => clearInterval(interval);
  }, [tabs, suspensionSettings]);

  // Add helper functions for domain rules
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const getDomainRule = (url: string): SuspensionRule | undefined => {
    const domain = getDomain(url);
    return suspensionSettings.rules.find(
      (rule) => rule.type === "domain" && rule.value === domain,
    );
  };

  const updateDomainRule = (
    url: string,
    action: "never" | "faster" | "normal",
  ) => {
    const domain = getDomain(url);
    const newRules = [...suspensionSettings.rules];
    const existingRuleIndex = newRules.findIndex(
      (rule) => rule.type === "domain" && rule.value === domain,
    );

    if (action === "normal") {
      // Remove any existing rule for this domain
      if (existingRuleIndex !== -1) {
        newRules.splice(existingRuleIndex, 1);
      }
    } else {
      const newRule: SuspensionRule = {
        type: "domain",
        value: domain,
        action: action === "never" ? "never" : "faster",
      };

      if (existingRuleIndex !== -1) {
        newRules[existingRuleIndex] = newRule;
      } else {
        newRules.push(newRule);
      }
    }

    setSuspensionSettings((prev) => ({
      ...prev,
      rules: newRules,
    }));

    // Save the updated settings
    saveTabsData();
  };

  useEffect(() => {
    console.log('Setting up message listener...');
    const handleMessage = (event: MessageEvent) => {
      console.log('Received message event:', event);
      if (event.data.type === 'tabsUpdated') {
        console.log('Setting tabs:', event.data.tabs);
        setTabs(event.data.tabs);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  console.log('Current tabs:', tabs);

  // Add function to update tab activity
  const updateTabActivity = (tabId: number) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, lastActiveTimestamp: Date.now() }
          : tab,
      ),
    );
  };

  // Add effect to listen for tab activation
  useEffect(() => {
    const handleTabActivated = async (activeInfo: { tabId: number }) => {
      updateTabActivity(activeInfo.tabId);
    };

    browser.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      browser.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, []);

  // Add effect to update active tab timestamp periodically
  useEffect(() => {
    const updateActiveTabTimestamp = async () => {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        updateTabActivity(activeTab.id);
      }
    };

    // Update every 5 seconds
    const interval = setInterval(updateActiveTabTimestamp, 5000);

    return () => clearInterval(interval);
  }, []);

  // Add effect to save suspension settings when they change
  useEffect(() => {
    const saveSuspensionSettings = async () => {
      try {
        await browser.storage.local.set({ suspensionSettings });
      } catch (error) {
        console.error("Error saving suspension settings:", error);
      }
    };

    saveSuspensionSettings();
  }, [suspensionSettings]);

  // Add effect to handle tab updates
  useEffect(() => {
    const handleTabUpdated = async (
      tabId: number,
      changeInfo: { status?: string; url?: string },
    ) => {
      if (changeInfo.status === "complete" || changeInfo.url) {
        try {
          const updatedTab = await browser.tabs.get(tabId);
          setTabs((prevTabs) =>
            prevTabs.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    title: updatedTab.title,
                    url: updatedTab.url,
                    favIconUrl: updatedTab.favIconUrl,
                    active: updatedTab.active,
                    windowId: updatedTab.windowId,
                    lastActiveTimestamp: Date.now(),
                  }
                : tab,
          ));
        } catch (error) {
          console.error("Error updating tab:", error);
        }
      }
    };

    browser.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, []);

  // Add effect to handle tab removal
  useEffect(() => {
    const handleTabRemoved = (tabId: number) => {
      setTabs((prevTabs) => prevTabs.filter((tab) => tab.id !== tabId));
      setSelectedTabIds((prevIds) => prevIds.filter((id) => id !== tabId));
    };

    browser.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      browser.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, []);

  // Update the Dialog's onOpenChange handler
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setIsVisible(open);
  };

  if (!isVisible) return null;

  // Render edit mode
  if (editingTab) {
    return (
      <Dialog open={true} onOpenChange={() => setEditingTab(null)}>
        <DialogContent className="w-full p-6 dark:bg-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold dark:text-white">
              Edit {editingTab.isBookmark ? "Bookmark" : "Tab"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tab-title" className="font-medium dark:text-white">
                Title
              </Label>
              <Input
                id="tab-title"
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tab-description" className="font-medium dark:text-white">
                Description
              </Label>
              <Input
                id="tab-description"
                type="text"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medium dark:text-white">URL</Label>
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300 break-all">
                {editingTab.url}
              </div>
            </div>

            {!editingTab.isBookmark && (
              <div className="space-y-2 pt-4 border-t dark:border-gray-700">
                <Label className="font-medium dark:text-white">
                  Suspension Settings for {getDomain(editingTab.url)}
                </Label>
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {/* Domain Rule */}
                  <div className="flex items-center gap-4">
                    <select
                      value={getDomainRule(editingTab.url)?.action || "normal"}
                      onChange={(e) =>
                        updateDomainRule(
                          editingTab.url,
                          e.target.value as "never" | "faster" | "normal",
                        )
                      }
                      className="px-2 py-1 rounded border dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      <option value="never">Never Suspend</option>
                      <option value="faster">Suspend Faster</option>
                      <option value="normal">Normal Suspension</option>
                    </select>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {getDomainRule(editingTab.url)?.action === "never" &&
                        "This domain will never be suspended"}
                      {getDomainRule(editingTab.url)?.action === "faster" &&
                        "This domain will be suspended after " +
                          suspensionSettings.fasterDelay +
                          " minutes"}
                      {(!getDomainRule(editingTab.url) ||
                        getDomainRule(editingTab.url)?.action === "normal") &&
                        "This domain follows default suspension rules"}
                    </span>
                  </div>

                  {/* Memory Usage Info */}
                  {editingTab.memoryUsage && (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {editingTab.memoryUsage.privateMemory && (
                        <p>
                          Current Memory Usage:{" "}
                          {formatMemorySize(
                            editingTab.memoryUsage.privateMemory,
                          )}
                        </p>
                      )}
                      {editingTab.memoryUsage.jsHeapSizeUsed && (
                        <p>
                          JS Heap Size:{" "}
                          {formatMemorySize(
                            editingTab.memoryUsage.jsHeapSizeUsed,
                          )}
                        </p>
                      )}
                      {editingTab.memoryUsage.privateMemory &&
                        editingTab.memoryUsage.privateMemory >=
                          suspensionSettings.memoryThreshold && (
                          <p className="text-amber-600 dark:text-amber-500">
                            ⚠️ Above memory threshold (
                            {formatMemorySize(
                              suspensionSettings.memoryThreshold,
                            )}
                            )
                          </p>
                        )}
                    </div>
                  )}

                  {/* Suspension Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {editingTab.suspended ? (
                        <span className="text-gray-600 dark:text-gray-300">
                          Suspended{" "}
                          {getTimeSince(editingTab.lastSuspendedTimestamp)}
                        </span>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300">
                          Last active{" "}
                          {getTimeSince(editingTab.lastActiveTimestamp)}
                        </span>
                      )}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (editingTab.suspended) {
                          restoreTab(editingTab);
                        } else {
                          suspendTab(editingTab);
                        }
                      }}
                      className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                    >
                      {editingTab.suspended ? "Restore Tab" : "Suspend Now"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-medium dark:text-white">Tags</Label>
              <div className="flex flex-wrap gap-1">
                {editingTab.tags && editingTab.tags.length > 0 ? (
                  editingTab.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs border border-blue-200 dark:border-blue-800"
                    >
                      {tag}
                      <button
                        className="ml-1 hover:text-red-500 dark:hover:text-red-400"
                        onClick={() => handleRemoveTag(editingTab.id, tag)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No tags added yet</p>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddTag();
                    }
                  }}
                  className="flex-1 dark:bg-gray-800 dark:text-white dark:border-gray-700"
                />
                <Button 
                  onClick={handleAddTag}
                  className="dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  Add Tag
                </Button>
              </div>

              {allTags.length > 0 && (
                <div className="mt-2">
                  <Label className="font-medium dark:text-white">Quick add:</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                        onClick={() => {
                          setNewTag(tag);
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setEditingTab(null)}
              className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              className="dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Render normal mode
  return (
    <>
      <Dialog open={isVisible} onOpenChange={handleOpenChange}>
        <DialogContent className="dark:bg-gray-900 dark:text-white max-w-4xl max-h-[90vh] overflow-hidden">
          <TabDialog 
            tabs={tabs} 
            onOpenSuspensionSettings={() => setShowSuspensionSettings(true)}
            onSuspendTab={suspendTab}
            onRestoreTab={restoreTab}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showSuspensionSettings} onOpenChange={setShowSuspensionSettings}>
        <DialogContent className="dark:bg-gray-900 dark:text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold dark:text-white">Suspension Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="enabled" className="dark:text-white">Enable Tab Suspension</Label>
              <input
                type="checkbox"
                id="enabled"
                checked={suspensionSettings.enabled}
                onChange={(e) =>
                  setSuspensionSettings({
                    ...suspensionSettings,
                    enabled: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultDelay" className="dark:text-white">Default Delay (minutes)</Label>
              <Input
                type="number"
                id="defaultDelay"
                value={suspensionSettings.defaultDelay}
                onChange={(e) =>
                  setSuspensionSettings({
                    ...suspensionSettings,
                    defaultDelay: parseInt(e.target.value, 10),
                  })
                }
                className="dark:bg-gray-800 dark:text-white dark:border-gray-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memoryThreshold" className="dark:text-white">Memory Threshold (MB)</Label>
              <Input
                type="number"
                id="memoryThreshold"
                value={Math.round(suspensionSettings.memoryThreshold / (1024 * 1024))}
                onChange={(e) =>
                  setSuspensionSettings({
                    ...suspensionSettings,
                    memoryThreshold: parseInt(e.target.value, 10) * 1024 * 1024,
                  })
                }
                className="dark:bg-gray-800 dark:text-white dark:border-gray-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fasterDelay" className="dark:text-white">Faster Delay (minutes)</Label>
              <Input
                type="number"
                id="fasterDelay"
                value={suspensionSettings.fasterDelay}
                onChange={(e) =>
                  setSuspensionSettings({
                    ...suspensionSettings,
                    fasterDelay: parseInt(e.target.value, 10),
                  })
                }
                className="dark:bg-gray-800 dark:text-white dark:border-gray-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-white">Suspension Rules</Label>
              <div className="space-y-2">
                {suspensionSettings.rules.map((rule, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 border rounded dark:border-gray-700"
                  >
                    <select
                      value={rule.type}
                      onChange={(e) => {
                        const newRules = [...suspensionSettings.rules];
                        newRules[index] = {
                          ...rule,
                          type: e.target.value as "domain" | "path",
                        };
                        setSuspensionSettings((prev) => ({
                          ...prev,
                          rules: newRules,
                        }));
                      }}
                      className="px-2 py-1 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-700"
                    >
                      <option value="domain">Domain</option>
                      <option value="path">Path</option>
                    </select>
                    <Input
                      value={rule.value}
                      onChange={(e) => {
                        const newRules = [...suspensionSettings.rules];
                        newRules[index] = { ...rule, value: e.target.value };
                        setSuspensionSettings((prev) => ({
                          ...prev,
                          rules: newRules,
                        }));
                      }}
                      placeholder={
                        rule.type === "domain" ? "example.com" : "/path"
                      }
                      className="dark:bg-gray-800 dark:text-white dark:border-gray-700"
                    />
                    <select
                      value={rule.action}
                      onChange={(e) => {
                        const newRules = [...suspensionSettings.rules];
                        newRules[index] = {
                          ...rule,
                          action: e.target.value as "never" | "faster" | "normal",
                        };
                        setSuspensionSettings((prev) => ({
                          ...prev,
                          rules: newRules,
                        }));
                      }}
                      className="px-2 py-1 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-700"
                    >
                      <option value="never">Never Suspend</option>
                      <option value="faster">Suspend Faster</option>
                      <option value="normal">Normal Suspension</option>
                    </select>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        const newRules = suspensionSettings.rules.filter(
                          (_, i) => i !== index,
                        );
                        setSuspensionSettings((prev) => ({
                          ...prev,
                          rules: newRules,
                        }));
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() => {
                    const newRule: SuspensionRule = {
                      type: "domain",
                      value: "",
                      action: "never",
                    };
                    setSuspensionSettings((prev) => ({
                      ...prev,
                      rules: [...prev.rules, newRule],
                    }));
                  }}
                  className="mt-2"
                >
                  Add Rule
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setShowSuspensionSettings(false)}
              className="mr-2 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveTabsData();
                setShowSuspensionSettings(false);
              }}
              className="dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-4 right-4 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleOpenAllFiltered}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"
        >
          Open All ({filteredItems.length})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSuspensionSettings(true)}
          className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"
        >
          Suspension Settings
        </Button>
      </div>
    </>
  );
};

export default App;
