import "./style.css";
import "./components/ui/ui.css";

import { AppProps, Tab } from "./types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "./components/ui";
import React, {
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useState,
} from "react";

import TabsList from "./components/TabsList";

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
    function update(
      tabId: number,
      updateProperties: { active: boolean },
    ): Promise<Tab>;
    function create(createProperties: { url: string }): Promise<Tab>;
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
}

interface TagFilter {
  tag: string;
  exclude: boolean;
}

const App: React.FC<AppProps> = ({ initialTabs = [] }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [bookmarks, setBookmarks] = useState<Tab[]>([]);
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

  const allItems = [...tabs, ...(showBookmarks ? bookmarks : [])];

  const filteredItems = allItems.filter((item) => {
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
  });

  useEffect(() => {
    // Add keyboard shortcut listener
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }

      // Close modal on Escape key
      if (e.key === "Escape" && isVisible) {
        if (editingTab) {
          // If in edit mode, exit edit mode first
          setEditingTab(null);
        } else {
          setIsVisible(false);
        }
      }

      // Handle arrow key navigation when modal is visible and not in edit mode
      if (isVisible && !editingTab) {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            if (filteredItems.length > 0) {
              setFocusedTabIndex((prev) => {
                const newIndex = prev < filteredItems.length - 1 ? prev + 1 : 0;
                return newIndex;
              });
            }
            break;
          case "ArrowUp":
            e.preventDefault();
            if (filteredItems.length > 0) {
              setFocusedTabIndex((prev) => {
                const newIndex = prev > 0 ? prev - 1 : filteredItems.length - 1;
                return newIndex;
              });
            }
            break;
          case "ArrowRight":
            // Navigate to next page or section if implemented
            break;
          case "ArrowLeft":
            // Navigate to previous page or section if implemented
            break;
          case "Enter":
            // Select the focused tab
            if (
              focusedTabIndex >= 0 &&
              focusedTabIndex < filteredItems.length
            ) {
              handleTabClick(filteredItems[focusedTabIndex].id);
            }
            break;
          default:
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, editingTab, filteredItems, focusedTabIndex]);

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

  const fetchBookmarks = async () => {
    try {
      const bookmarkTree = await browser.bookmarks.getTree();
      const flattenedBookmarks: Tab[] = [];

      // Recursive function to flatten bookmark tree
      const flattenBookmarks = (
        nodes: browser.bookmarks.BookmarkTreeNode[],
      ) => {
        for (const node of nodes) {
          if (node.url) {
            // It's a bookmark
            flattenedBookmarks.push({
              id: parseInt(node.id), // Convert string ID to number
              title: node.title,
              url: node.url,
              active: false,
              tags: [],
              labels: [],
              customTitle: null,
              description: null,
              isBookmark: true,
            });
          }

          if (node.children) {
            flattenBookmarks(node.children);
          }
        }
      };

      flattenBookmarks(bookmarkTree);
      setBookmarks(flattenedBookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
    }
  };

  const handleTabClick = (tabId: number) => {
    // If we're in edit mode, don't do anything
    if (editingTab) return;

    // If we're in tag management mode, toggle selection
    if (isVisible) {
      setSelectedTabIds((prevSelectedIds) => {
        if (prevSelectedIds.includes(tabId)) {
          return prevSelectedIds.filter((id) => id !== tabId);
        } else {
          return [...prevSelectedIds, tabId];
        }
      });
    } else {
      // If it's a bookmark, open it in a new tab
      const clickedItem = allItems.find((item) => item.id === tabId);
      if (clickedItem?.isBookmark) {
        browser.tabs.create({ url: clickedItem.url });
      } else {
        // Otherwise, activate the tab
        browser.tabs.update(tabId, { active: true });
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
      // Create a map of tabId -> data for storage
      const tabsData = [...tabs, ...bookmarks].reduce(
        (acc, item) => {
          const data: Record<string, unknown> = {};

          if (item.tags && item.tags.length > 0) {
            data.tags = item.tags;
          }

          if (item.customTitle) {
            data.customTitle = item.customTitle;
          }

          if (item.description) {
            data.description = item.description;
          }

          if (Object.keys(data).length > 0) {
            acc[item.id] = data;
          }

          return acc;
        },
        {} as Record<number, Record<string, unknown>>,
      );

      await browser.storage.local.set({ tabsData });
    } catch (error) {
      console.error("Error saving tabs data:", error);
    }
  };

  const loadTabsData = async () => {
    try {
      const result = await browser.storage.local.get("tabsData");
      const storedData =
        (result.tabsData as Record<number, Record<string, unknown>>) || {};

      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          const data = storedData[tab.id];
          if (!data) return tab;

          return {
            ...tab,
            tags: (data.tags as string[]) || [],
            customTitle: (data.customTitle as string) || null,
            description: (data.description as string) || null,
          };
        }),
      );

      setBookmarks((prevBookmarks) =>
        prevBookmarks.map((bookmark) => {
          const data = storedData[bookmark.id];
          if (!data) return bookmark;

          return {
            ...bookmark,
            tags: (data.tags as string[]) || [],
            customTitle: (data.customTitle as string) || null,
            description: (data.description as string) || null,
          };
        }),
      );
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

  if (!isVisible) return null;

  // Render edit mode
  if (editingTab) {
    return (
      <Dialog open={true} onOpenChange={() => setEditingTab(null)}>
        <DialogContent className="w-full max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Edit {editingTab.isBookmark ? "Bookmark" : "Tab"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tab-title" className="font-medium">
                Title
              </Label>
              <Input
                id="tab-title"
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tab-description" className="font-medium">
                Description
              </Label>
              <Input
                id="tab-description"
                type="text"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medium">URL</Label>
              <div className="p-2 bg-gray-50 rounded text-gray-600 break-all">
                {editingTab.url}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-medium">Tags</Label>
              <div className="flex flex-wrap gap-1">
                {editingTab.tags && editingTab.tags.length > 0 ? (
                  editingTab.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200"
                    >
                      {tag}
                      <button
                        className="ml-1 hover:text-red-500"
                        onClick={() => handleRemoveTag(editingTab.id, tag)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No tags added yet</p>
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
                  className="flex-1"
                />
                <Button onClick={handleAddTag}>Add Tag</Button>
              </div>

              {allTags.length > 0 && (
                <div className="mt-2">
                  <Label className="font-medium">Quick add:</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
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
              className="bg-white hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Render normal mode
  return (
    <Dialog open={true} onOpenChange={() => setIsVisible(false)}>
      <DialogContent className="w-[90vw] max-w-7xl">
        <DialogHeader className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              className="w-full"
              placeholder="Search by title/tags... (Press Tab to add as filter)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchInputKeyDown}
              autoFocus
            />
          </div>

          {tagFilters.length > 0 && (
            <div className="space-y-2">
              <Label className="font-medium">Active filters:</Label>
              <div className="flex flex-wrap gap-1">
                {tagFilters.map((filter) => (
                  <span
                    key={filter.tag}
                    className={`
                      inline-flex items-center px-2 py-0.5 rounded text-xs border
                      ${
                        filter.exclude
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }
                    `}
                  >
                    {filter.exclude ? "!" : ""}
                    {filter.tag}
                    <button
                      className="ml-1 hover:text-red-500"
                      onClick={() => handleRemoveTagFilter(filter.tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleBookmarks}
              className="bg-white hover:bg-gray-50"
            >
              {showBookmarks ? "Hide Bookmarks" : "Show Bookmarks"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={
                selectedTabIds.length > 0 ? handleDeselectAll : handleSelectAll
              }
              className="bg-white hover:bg-gray-50"
            >
              {selectedTabIds.length > 0 ? "Deselect All" : "Select All"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenAllFiltered}
              className="bg-gray-100 hover:bg-gray-200"
            >
              Open All ({filteredItems.length})
            </Button>
          </div>

          <div className="flex flex-wrap gap-1 items-center">
            {allTags.map((tag) => (
              <div key={tag} className="inline-flex items-center">
                <button
                  className={`
                    px-2 py-0.5 rounded text-xs
                    ${
                      tagFilters.some((f) => f.tag === tag)
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }
                  `}
                  onClick={() => handleTagClick(tag)}
                >
                  {tag}
                </button>
                <button
                  className="w-4 h-4 ml-0.5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-500 hover:text-white text-[10px]"
                  onClick={() => handleTagClick(tag, true)}
                  title="Exclude this tag"
                >
                  !
                </button>
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] p-4">
          <TabsList
            tabs={filteredItems}
            onTabClick={handleTabClick}
            selectedTabIds={selectedTabIds}
            onRemoveTag={handleRemoveTag}
            onEditTab={handleEditTab}
          />
        </div>

        <DialogFooter className="p-4 border-t border-gray-200">
          <div className="flex gap-2 w-full">
            <Input
              type="text"
              placeholder="Add a tag to selected or filtered tabs..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (selectedTabIds.length > 0) {
                    handleAddTag();
                  } else {
                    handleApplyTagToAll();
                  }
                }
              }}
              className="flex-1"
            />
            {selectedTabIds.length > 0 ? (
              <Button onClick={handleAddTag}>
                Add Tag to Selected ({selectedTabIds.length})
              </Button>
            ) : (
              <Button onClick={handleApplyTagToAll}>
                Add Tag to All Filtered ({filteredItems.length})
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default App;
