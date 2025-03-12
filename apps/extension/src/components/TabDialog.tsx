import { Button, DialogHeader, DialogTitle, Input, Label } from '@tag/ui';
import React, { useState } from 'react';

import type { Tab } from '../../../extension/entrypoints/tabs-modal/types';
import { browser } from 'wxt/browser';

interface TabDialogProps {
  tabs: Tab[];
  onOpenSuspensionSettings?: () => void;
  onSuspendTab?: (tab: Tab) => void;
  onRestoreTab?: (tab: Tab) => void;
}

export function TabDialog({ 
  tabs, 
  onOpenSuspensionSettings,
  onSuspendTab,
  onRestoreTab,
}: TabDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  const filteredTabs = tabs.filter(tab => {
    const matchesSearch = !searchQuery || 
      (tab.title?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (tab.url?.toLowerCase().includes(searchQuery.toLowerCase()) || false);

    const matchesTags = tagFilters.length === 0 ||
      tagFilters.every(tag => tab.tags?.includes(tag) || false);

    return matchesSearch && matchesTags;
  });

  const allTags = Array.from(new Set(
    tabs.flatMap(tab => tab.tags || [])
  )).sort();

  const handleTagClick = (tag: string) => {
    setTagFilters(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleTabClick = async (tab: Tab) => {
    if (tab.suspended && onRestoreTab) {
      await onRestoreTab(tab);
    } else if (tab.id && tab.windowId) {
      await browser.tabs.update(tab.id, { active: true });
      await browser.windows.update(tab.windowId, { focused: true });
    }
  };

  const handleBookmarkClick = async (tab: Tab) => {
    if (!tab.url) return;

    if (tab.bookmarked) {
      const bookmarks = await browser.bookmarks.search({ url: tab.url });
      for (const bookmark of bookmarks) {
        await browser.bookmarks.remove(bookmark.id);
      }
    } else {
      await browser.bookmarks.create({
        title: tab.title,
        url: tab.url
      });
    }
  };

  const handleCloseTab = async (tab: Tab) => {
    if (tab.id) {
      try {
        await browser.tabs.remove(tab.id);
      } catch (error) {
        console.error("Error closing tab:", error);
      }
    }
  };

  const getTimeSince = (timestamp?: number): string => {
    if (!timestamp) return "Never";

    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  };

  return (
    <div className="flex flex-col h-full">
      <DialogHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <DialogTitle>Manage Tabs</DialogTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSuspensionSettings}
            className="dark:bg-gray-800 dark:text-white"
          >
            Suspension Settings
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tabs by title or URL..."
              className="w-full dark:bg-gray-800"
            />
          </div>

          {allTags.length > 0 && (
            <div>
              <Label>Filter by Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allTags.map(tag => (
                  <Button
                    key={tag}
                    variant={tagFilters.includes(tag) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTagClick(tag)}
                    className="dark:bg-gray-800 dark:text-white"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto mt-4">
        <div className="space-y-2">
          {filteredTabs.map(tab => (
            <div
              key={tab.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              onClick={() => handleTabClick(tab)}
            >
              {tab.favIconUrl && (
                <img
                  src={tab.favIconUrl}
                  alt=""
                  className="w-4 h-4"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{tab.title}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {tab.url}
                </div>
                {tab.tags && tab.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tab.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {tab.memoryUsage && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(tab.memoryUsage.privateMemory || 0 / 1024 / 1024)} MB
                  {(tab.memoryUsage.privateMemory || 0) >= 500 * 1024 * 1024 && (
                    <span className="ml-1 text-amber-500">⚠️</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                {tab.suspended && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Suspended {getTimeSince(tab.lastSuspendedTimestamp)}
                  </span>
                )}
                {!tab.suspended && tab.lastActiveTimestamp && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Active {getTimeSince(tab.lastActiveTimestamp)}
                  </span>
                )}
                {onSuspendTab && onRestoreTab && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tab.suspended) {
                        onRestoreTab(tab);
                      } else {
                        onSuspendTab(tab);
                      }
                    }}
                  >
                    {tab.suspended ? '↺' : '⏸'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookmarkClick(tab);
                  }}
                  className={tab.bookmarked ? 'text-yellow-500' : ''}
                >
                  {tab.bookmarked ? '★' : '☆'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab);
                  }}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 