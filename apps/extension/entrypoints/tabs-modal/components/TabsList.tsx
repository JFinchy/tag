import React, { useEffect } from "react";

import { Tab } from "../types";

interface TabsListProps {
  tabs: Tab[];
  onTabClick: (tabId: number) => void;
  selectedTabIds: number[];
  onRemoveTag: (tabId: number, tag: string) => void;
  onEditTab: (tab: Tab) => void;
  onReorderTabs?: (startIndex: number, endIndex: number) => void;
  focusedTabIndex: number;
  onSuspendTab?: (tab: Tab) => void;
  onRestoreTab?: (tab: Tab) => void;
}

const TabsList: React.FC<TabsListProps> = ({
  tabs,
  onTabClick,
  selectedTabIds,
  onRemoveTag,
  onEditTab,
  onReorderTabs,
  focusedTabIndex,
  onSuspendTab,
  onRestoreTab,
}) => {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

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
      if (!selectedTabIds.length) return;

      const selectedIndex = tabs.findIndex((tab) =>
        selectedTabIds.includes(tab.id),
      );
      if (selectedIndex === -1) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex < tabs.length - 1 && onReorderTabs) {
          onReorderTabs(selectedIndex, selectedIndex + 1);
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0 && onReorderTabs) {
          onReorderTabs(selectedIndex, selectedIndex - 1);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedTabIds, tabs, onReorderTabs]);

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedIndex(null);
    e.currentTarget.classList.remove("opacity-50");
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    dropIndex: number,
  ) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex && onReorderTabs) {
      onReorderTabs(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  // Add memory warning threshold (500MB)
  const MEMORY_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB in bytes

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4 h-full">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
          onClick={() => onTabClick(tab.id)}
          className={`
            relative flex flex-col p-3 rounded cursor-pointer border border-gray-200 h-full
            hover:bg-gray-100 transition-colors
            ${tab.active ? "bg-blue-50 border-l-3 border-l-blue-600" : ""}
            ${selectedTabIds.includes(tab.id) ? "bg-blue-50/10 border-blue-600/30 ring-2 ring-blue-500" : ""}
            ${tab.isBookmark ? "border-l-3 border-l-yellow-500" : ""}
            ${focusedTabIndex === index ? "ring-2 ring-blue-400" : ""}
            ${draggedIndex === index ? "opacity-50" : ""}
            ${tab.memoryUsage?.privateMemory && tab.memoryUsage.privateMemory >= MEMORY_WARNING_THRESHOLD ? "border-red-200" : ""}
            ${tab.suspended ? "opacity-50" : ""}
            select-none
          `}
        >
          {/* Add suspension badge */}
          {tab.suspended && (
            <div className="absolute top-0 right-0 p-1">
              <span className="inline-flex items-center px-2 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium border border-gray-200">
                Suspended
              </span>
            </div>
          )}

          <div className="flex items-center">
            <div className="mr-2 text-gray-400 select-none cursor-move">⋮⋮</div>
            {tab.favIconUrl && (
              <img
                src={tab.favIconUrl}
                alt=""
                className="w-4 h-4 mr-3 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-gray-900">
                  {tab.customTitle || tab.title}
                </div>
                {tab.active && (
                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-800 rounded-full">
                    Active Now
                  </span>
                )}
              </div>
              {tab.isBookmark && tab.originalUrl && (
                <div className="truncate text-xs text-gray-500">
                  {tab.originalUrl}
                </div>
              )}
              {!tab.isBookmark && (
                <div className="truncate text-xs text-gray-500">
                  Last opened: {getTimeSince(tab.lastActiveTimestamp)}
                </div>
              )}
            </div>
            <div className="flex gap-1 ml-2">
              {/* Add suspend/restore button */}
              {!tab.isBookmark && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tab.suspended) {
                      onRestoreTab?.(tab);
                    } else {
                      onSuspendTab?.(tab);
                    }
                  }}
                  className="p-1 rounded hover:bg-gray-200 text-gray-600"
                  title={tab.suspended ? "Restore Tab" : "Suspend Tab"}
                >
                  {tab.suspended ? "↺" : "⏸"}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTab(tab);
                }}
                className="p-1 rounded hover:bg-gray-200 text-gray-600"
              >
                ✎
              </button>
            </div>
          </div>

          {(tab.description ||
            (tab.tags && tab.tags.length > 0) ||
            tab.lastActiveTimestamp ||
            tab.memoryUsage ||
            tab.suspended) && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-dashed border-gray-200">
              {tab.active && (
                <span className="inline-block px-2 py-0.5 bg-blue-600 text-white rounded text-xs">
                  Active
                </span>
              )}
              {tab.isBookmark && (
                <span className="inline-block px-2 py-0.5 bg-yellow-500 text-white rounded text-xs">
                  Bookmark
                </span>
              )}
              {tab.suspended && (
                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  Suspended {getTimeSince(tab.lastSuspendedTimestamp)}
                </span>
              )}
              <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                {getTimeSince(tab.lastActiveTimestamp)}
              </span>
              {tab.description && (
                <div className="w-full text-sm text-gray-600 mt-1 line-clamp-2">
                  {tab.description}
                </div>
              )}
              {tab.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200"
                >
                  {tag}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTag(tab.id, tag);
                    }}
                    className="ml-1 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
              {!tab.isBookmark && tab.memoryUsage && (
                <div className="flex gap-1">
                  {tab.memoryUsage.jsHeapSizeUsed && (
                    <span
                      className={`
                        inline-block px-2 py-0.5 rounded text-xs border
                        ${
                          tab.memoryUsage.jsHeapSizeUsed >=
                          MEMORY_WARNING_THRESHOLD
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }
                      `}
                      title="JavaScript Heap Size"
                    >
                      JS: {formatMemorySize(tab.memoryUsage.jsHeapSizeUsed)}
                    </span>
                  )}
                  {tab.memoryUsage.privateMemory && (
                    <span
                      className={`
                        inline-block px-2 py-0.5 rounded text-xs border
                        ${
                          tab.memoryUsage.privateMemory >=
                          MEMORY_WARNING_THRESHOLD
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        }
                      `}
                      title="Private Memory"
                    >
                      Mem: {formatMemorySize(tab.memoryUsage.privateMemory)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TabsList;
