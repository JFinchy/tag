import React from "react";
import { Tab } from "../types";

interface TabsListProps {
  tabs: Tab[];
  onTabClick: (tabId: number) => void;
  selectedTabIds: number[];
  onRemoveTag: (tabId: number, tag: string) => void;
  onEditTab: (tab: Tab) => void;
}

const TabsList: React.FC<TabsListProps> = ({
  tabs,
  onTabClick,
  selectedTabIds,
  onRemoveTag,
  onEditTab,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          className={`
            flex flex-col p-3 rounded cursor-pointer border border-gray-200 h-full
            hover:bg-gray-100 transition-colors
            ${tab.active ? "bg-blue-50 border-l-3 border-l-blue-600" : ""}
            ${selectedTabIds.includes(tab.id) ? "bg-blue-50/10 border-blue-600/30" : ""}
            ${tab.isBookmark ? "border-l-3 border-l-yellow-500" : ""}
          `}
        >
          <div className="flex items-center">
            {tab.favIconUrl && (
              <img
                src={tab.favIconUrl}
                alt=""
                className="w-4 h-4 mr-3 flex-shrink-0"
              />
            )}
            <div className="flex-1 truncate text-gray-900">
              {tab.customTitle || tab.title}
            </div>
            <div className="flex gap-1 ml-2">
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

          {(tab.description || tab.tags?.length > 0) && (
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
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TabsList;
