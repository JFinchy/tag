import React from "react";
import { TabsListProps } from "../types";

const TabsList: React.FC<TabsListProps> = ({
  tabs,
  onTabClick,
  selectedTabId,
  onRemoveTag,
  onEditTab,
}) => {
  if (tabs.length === 0) {
    return <div>No tabs found</div>;
  }

  return (
    <div className="tabs-list">
      {tabs.map((tab) => {
        const isSelected = selectedTabId === tab.id;
        const displayTitle = tab.customTitle || tab.title;

        return (
          <div
            key={tab.id}
            className={`tab-item ${tab.active ? "tab-item-active" : ""} ${isSelected ? "tab-item-selected" : ""}`}
            onClick={() => onTabClick(tab.id)}
          >
            <div className="tab-item-content">
              {tab.favIconUrl && (
                <img
                  src={tab.favIconUrl}
                  alt=""
                  className="tab-item-icon"
                  onError={(e) => {
                    // Handle favicon loading errors
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="tab-item-title">{displayTitle}</div>

              <div className="tab-item-actions">
                {onEditTab && (
                  <button
                    className="edit-tab-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTab(tab);
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {tab.tags && tab.tags.length > 0 && (
              <div className="tab-item-meta">
                {tab.active && (
                  <span className="tab-active-indicator">Active</span>
                )}
                {tab.tags.map((tag, index) => (
                  <span key={`tag-${index}`} className="tag">
                    {tag}
                    {onRemoveTag && isSelected && (
                      <button
                        className="remove-tag-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTag(tab.id, tag);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {tab.labels?.map((label, index) => (
                  <span key={`label-${index}`} className="label">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabsList;
