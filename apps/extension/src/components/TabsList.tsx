import React, { useEffect, useState } from "react";

import { Tab } from "../../entrypoints/tabs-modal/types";

interface TabsListProps {
  items: Tab[];
  selectedIds: number[];
  onSelect: (ids: number[]) => void;
  onTagAdd: (tabId: number, tag: string) => void;
  onTagRemove: (tabId: number, tag: string) => void;
  onSuspend: (tabId: number) => void;
  onRestore: (tabId: number) => void;
}

export function TabsList({
  items,
  selectedIds,
  onSelect,
  onTagAdd,
  onTagRemove,
  onSuspend,
  onRestore,
}: TabsListProps) {
  const [editingTabId, setEditingTabId] = useState<number | null>(null);
  const [newTag, setNewTag] = useState('');

  const getTimeSince = (timestamp?: number): string => {
    if (!timestamp) return "Never accessed";

    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  };

  const formatMemorySize = (bytes?: number): string => {
    if (bytes === undefined) return "";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedIds.length) return;

      const selectedIndex = items.findIndex((tab) =>
        selectedIds.includes(tab.id),
      );
      if (selectedIndex === -1) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex < items.length - 1) {
          onSelect([...selectedIds, items[selectedIndex + 1].id]);
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0) {
          onSelect(selectedIds.filter((id) => id !== items[selectedIndex].id));
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, items, onSelect]);

  const handleTagAdd = (tabId: number) => {
    if (newTag.trim()) {
      onTagAdd(tabId, newTag.trim());
      setNewTag('');
      setEditingTabId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabId: number) => {
    if (e.key === 'Enter') {
      handleTagAdd(tabId);
    }
  };

  const formatMemoryUsage = (memoryUsage?: { jsHeapSizeUsed?: number; privateMemory?: number }) => {
    if (!memoryUsage) return null;

    const formatBytes = (bytes?: number) => {
      if (!bytes) return null;
      const units = ['B', 'KB', 'MB', 'GB'];
      let value = bytes;
      let unitIndex = 0;

      while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
      }

      return `${value.toFixed(1)} ${units[unitIndex]}`;
    };

    const jsHeap = formatBytes(memoryUsage.jsHeapSizeUsed);
    const privateMemory = formatBytes(memoryUsage.privateMemory);

    if (jsHeap && privateMemory) {
      return `JS: ${jsHeap}, Private: ${privateMemory}`;
    } else if (jsHeap) {
      return `JS: ${jsHeap}`;
    } else if (privateMemory) {
      return `Private: ${privateMemory}`;
    }

    return null;
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center justify-between rounded-md border p-2 ${
            selectedIds.includes(item.id) ? 'border-blue-500' : ''
          }`}
        >
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  onSelect([...selectedIds, item.id]);
                } else {
                  onSelect(selectedIds.filter((id) => id !== item.id));
                }
              }}
              className="mr-2"
            />
            {item.favIconUrl && (
              <img src={item.favIconUrl} alt="" className="mr-2 h-4 w-4" />
            )}
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-sm text-gray-500">{item.url}</div>
              {item.memoryUsage && (
                <div className="mt-1 text-xs text-gray-500">
                  {formatMemoryUsage(item.memoryUsage)}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {item.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => onTagRemove(item.id, tag)}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {editingTabId === item.id && (
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                      placeholder="Add tag..."
                      className="w-24 rounded-md border px-2 py-0.5 text-xs"
                    />
                    <button
                      onClick={() => handleTagAdd(item.id)}
                      className="ml-1 rounded-md bg-blue-500 px-2 py-0.5 text-xs text-white"
                    >
                      Add
                    </button>
                  </div>
                )}
                <button
                  onClick={() =>
                    setEditingTabId(editingTabId === item.id ? null : item.id)
                  }
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                >
                  {editingTabId === item.id ? 'Cancel' : '+'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!item.isBookmark && (
              item.suspended ? (
                <button
                  onClick={() => onRestore(item.id)}
                  className="rounded-md bg-green-500 px-3 py-1 text-sm text-white"
                >
                  Restore
                </button>
              ) : (
                <button
                  onClick={() => onSuspend(item.id)}
                  className="rounded-md bg-yellow-500 px-3 py-1 text-sm text-white"
                >
                  Suspend
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
