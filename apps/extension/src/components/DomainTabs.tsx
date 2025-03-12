import { Button } from '@tag/ui';
import { Loader2 } from 'lucide-react';
import React from 'react';
import { TabList } from './TabList';
import { useDomainStorage } from '../hooks/useDomainStorage';

interface DomainTabsProps {
  url: string;
  onTabSelect?: (tabId: number) => void;
}

export function DomainTabs({ url, onTabSelect }: DomainTabsProps) {
  const {
    isEnabled,
    tabs,
    bookmarks,
    loading,
    error,
    updateTabs,
    updateBookmarks,
  } = useDomainStorage(url);

  if (!isEnabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <p>Error: {error.message}</p>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const handleTagUpdate = async (tabId: number, tags: string[]) => {
    const updatedTabs = tabs.map(tab =>
      tab.id === tabId ? { ...tab, tags } : tab
    );
    await updateTabs(updatedTabs);
  };

  const handleBookmarkToggle = async (tabId: number) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    const isBookmarked = bookmarks.some(b => b.id === tabId);
    if (isBookmarked) {
      await updateBookmarks(bookmarks.filter(b => b.id !== tabId));
    } else {
      await updateBookmarks([...bookmarks, { ...tab, bookmarked: true }]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h2 className="text-lg font-semibold">Domain Tabs</h2>
        <p className="text-sm text-gray-500">
          These tabs are stored locally for {new URL(url).hostname}
        </p>
      </div>

      <TabList
        tabs={tabs}
        bookmarks={bookmarks}
        onTagUpdate={handleTagUpdate}
        onBookmarkToggle={handleBookmarkToggle}
        onSelect={onTabSelect}
      />

      {tabs.length === 0 && (
        <div className="text-center text-gray-500 p-4">
          No tabs stored for this domain
        </div>
      )}
    </div>
  );
} 