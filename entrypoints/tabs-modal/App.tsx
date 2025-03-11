import "./style.css";

import { Tab, AppProps } from "./types";
import React, { useEffect, useState } from "react";

import TabsList from "./components/TabsList";

const App: React.FC<AppProps> = ({ initialTabs = [] }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [newTag, setNewTag] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [editingTab, setEditingTab] = useState<Tab | null>(null);
  const [editedTitle, setEditedTitle] = useState("");

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
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, editingTab]);

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
        };
      });
      setTabs(updatedTabs);

      // Update all tags list
      updateAllTagsList(updatedTabs);
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
  }, [tabs]);

  useEffect(() => {
    // If we don't have initial tabs, fetch them when modal becomes visible
    if (isVisible && tabs.length === 0) {
      fetchTabs();
    }

    // Update all tags list when tabs change
    updateAllTagsList(tabs);
  }, [isVisible, tabs.length]);

  const updateAllTagsList = (tabsArray: Tab[]) => {
    const tagsSet = new Set<string>();
    tabsArray.forEach((tab) => {
      tab.tags?.forEach((tag) => tagsSet.add(tag));
    });
    setAllTags(Array.from(tagsSet));
  };

  const fetchTabs = async () => {
    try {
      const allTabs = await browser.runtime.sendMessage({ action: "getTabs" });
      const tabsWithTags = allTabs.map((tab: Tab) => ({
        ...tab,
        tags: [],
        labels: [],
        customTitle: null,
      }));
      setTabs(tabsWithTags);
    } catch (error) {
      console.error("Error fetching tabs:", error);
    }
  };

  const filteredTabs = tabs.filter((tab) => {
    const query = searchQuery.toLowerCase();
    const title = tab.customTitle || tab.title;
    return (
      title.toLowerCase().includes(query) ||
      tab.url.toLowerCase().includes(query) ||
      tab.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
      tab.labels?.some((label) => label.toLowerCase().includes(query))
    );
  });

  const handleTabClick = (tabId: number) => {
    // If we're in edit mode, don't do anything
    if (editingTab) return;

    // If we're in tag management mode, select the tab instead of navigating
    if (isVisible) {
      setSelectedTabId(tabId === selectedTabId ? null : tabId);
    } else {
      browser.tabs.update(tabId, { active: true });
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim() || !selectedTabId) return;

    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === selectedTabId) {
          const updatedTags = [...(tab.tags || [])];
          if (!updatedTags.includes(newTag.trim())) {
            updatedTags.push(newTag.trim());
          }
          return { ...tab, tags: updatedTags };
        }
        return tab;
      }),
    );

    setNewTag("");
    updateAllTagsList(tabs);

    // Save tags to storage
    saveTabsData();
  };

  const handleRemoveTag = (tabId: number, tagToRemove: string) => {
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

    // Save tags to storage
    saveTabsData();
  };

  const handleEditTab = (tab: Tab) => {
    setEditingTab(tab);
    setEditedTitle(tab.customTitle || tab.title);
  };

  const handleSaveEdit = () => {
    if (!editingTab) return;

    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === editingTab.id) {
          return {
            ...tab,
            customTitle: editedTitle.trim() || null,
          };
        }
        return tab;
      }),
    );

    setEditingTab(null);
    saveTabsData();
  };

  const saveTabsData = async () => {
    try {
      // Create a map of tabId -> data for storage
      const tabsData = tabs.reduce(
        (acc, tab) => {
          const data: Record<string, unknown> = {};

          if (tab.tags && tab.tags.length > 0) {
            data.tags = tab.tags;
          }

          if (tab.customTitle) {
            data.customTitle = tab.customTitle;
          }

          if (Object.keys(data).length > 0) {
            acc[tab.id] = data;
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
          };
        }),
      );
    } catch (error) {
      console.error("Error loading tabs data:", error);
    }
  };

  // Load tags when tabs are first loaded
  useEffect(() => {
    if (tabs.length > 0) {
      loadTabsData();
    }
  }, [initialTabs]);

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
  };

  if (!isVisible) return null;

  // Render edit mode
  if (editingTab) {
    return (
      <div className="tabs-modal-overlay" onClick={() => setEditingTab(null)}>
        <div className="tabs-modal" onClick={(e) => e.stopPropagation()}>
          <div className="tabs-modal-header">
            <h2>Edit Tab</h2>
          </div>
          <div className="tabs-modal-content">
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="tab-title">Tab Title</label>
                <input
                  id="tab-title"
                  type="text"
                  className="form-input"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>URL</label>
                <div className="url-display">{editingTab.url}</div>
              </div>

              <div className="form-group">
                <label>Tags</label>
                <div className="tags-container">
                  {editingTab.tags && editingTab.tags.length > 0 ? (
                    editingTab.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                        <button
                          className="remove-tag-btn"
                          onClick={() => handleRemoveTag(editingTab.id, tag)}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <p>No tags added yet</p>
                  )}
                </div>

                <div className="tag-input-container">
                  <input
                    type="text"
                    className="tag-input"
                    placeholder="Add a tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddTag();
                      }
                    }}
                  />
                  <button className="add-tag-button" onClick={handleAddTag}>
                    Add Tag
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="tabs-modal-footer">
            <button
              className="cancel-button"
              onClick={() => setEditingTab(null)}
            >
              Cancel
            </button>
            <button className="save-button" onClick={handleSaveEdit}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render normal mode
  return (
    <div className="tabs-modal-overlay" onClick={() => setIsVisible(false)}>
      <div className="tabs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tabs-modal-header">
          <input
            type="text"
            className="tabs-modal-search"
            placeholder="Search by title/tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <div className="all-tags-container">
            {allTags.map((tag) => (
              <span
                key={tag}
                className="tag clickable"
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="tabs-modal-content">
          <TabsList
            tabs={filteredTabs}
            onTabClick={handleTabClick}
            selectedTabId={selectedTabId}
            onRemoveTag={handleRemoveTag}
            onEditTab={handleEditTab}
          />
        </div>
        {selectedTabId && (
          <div className="tabs-modal-footer">
            <div className="tag-input-container">
              <input
                type="text"
                className="tag-input"
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddTag();
                  }
                }}
              />
              <button className="add-tag-button" onClick={handleAddTag}>
                Add Tag
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
