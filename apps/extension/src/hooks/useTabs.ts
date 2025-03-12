import { useCallback, useEffect, useState } from 'react';

import type { TabData } from '../utils/domainStorage';
import { useDomainStorage } from './useDomainStorage';

interface Tab extends Omit<TabData, 'bookmarked'> {
  favIconUrl?: string;
  suspended?: boolean;
}

interface TabGroup {
  id: string;
  name: string;
  tabs: number[]; // Tab IDs
}

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { isEnabled, updateTabs } = useDomainStorage(window.location.href);

  // Load initial tabs
  useEffect(() => {
    const loadTabs = async () => {
      try {
        const queryInfo = { currentWindow: true };
        const chromeTabs = await browser.tabs.query(queryInfo);
        const processedTabs = await Promise.all(
          chromeTabs.map(async (tab) => {
            if (!tab.id) return null;

            let memoryUsage;
            try {
              const processInfo = await browser.processes?.getProcessInfo([tab.id]);
              if (processInfo?.[0]) {
                memoryUsage = {
                  privateMemory: processInfo[0].privateMemory || 0,
                  jsHeapSizeUsed: processInfo[0].jsMemoryUsed || 0
                };
              }
            } catch (e) {
              console.warn('Memory info not available:', e);
            }
            
            return {
              id: tab.id,
              url: tab.url || '',
              title: tab.title || '',
              favIconUrl: tab.favIconUrl,
              customTitle: undefined,
              description: undefined,
              tags: [],
              lastAccessed: Date.now(),
              memoryUsage,
              suspended: false
            } as Tab;
          })
        );

        const validTabs = processedTabs.filter((tab): tab is Tab => tab !== null);
        setTabs(validTabs);
        if (isEnabled) {
          await updateTabs(validTabs.map(tab => ({
            ...tab,
            bookmarked: false
          })));
        }

        const active = chromeTabs.find(tab => tab.active);
        if (active?.id) {
          setActiveTab(active.id);
        }
      } catch (error) {
        console.error('Error loading tabs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTabs();

    // Listen for tab updates
    const handleTabUpdate = async (tabId: number, changeInfo: any, tab: browser.tabs.Tab) => {
      setTabs(prev => {
        const updated = prev.map(t => 
          t.id === tabId ? {
            ...t,
            url: tab.url || t.url,
            title: tab.title || t.title,
            favIconUrl: tab.favIconUrl || t.favIconUrl,
            lastAccessed: Date.now()
          } : t
        );
        if (isEnabled) {
          updateTabs(updated.map(tab => ({
            ...tab,
            bookmarked: false
          })));
        }
        return updated;
      });
    };

    const handleTabActivated = async (activeInfo: { tabId: number }) => {
      setActiveTab(activeInfo.tabId);
      setTabs(prev => {
        const updated = prev.map(t => 
          t.id === activeInfo.tabId ? {
            ...t,
            lastAccessed: Date.now()
          } : t
        );
        if (isEnabled) {
          updateTabs(updated.map(tab => ({
            ...tab,
            bookmarked: false
          })));
        }
        return updated;
      });
    };

    browser.tabs.onUpdated.addListener(handleTabUpdate);
    browser.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      browser.tabs.onUpdated.removeListener(handleTabUpdate);
      browser.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [isEnabled, updateTabs]);

  const switchToTab = useCallback(async (tabId: number) => {
    try {
      await browser.tabs.update(tabId, { active: true });
      const tab = await browser.tabs.get(tabId);
      if (tab.windowId) {
        const win = await browser.windows.get(tab.windowId);
        if (win.id && !win.focused) {
          await browser.windows.update(win.id, { focused: true });
        }
      }
    } catch (error) {
      console.error('Error switching tab:', error);
    }
  }, []);

  const closeTab = useCallback(async (tabId: number) => {
    try {
      await browser.tabs.remove(tabId);
      setTabs(prev => {
        const updated = prev.filter(t => t.id !== tabId);
        if (isEnabled) {
          updateTabs(updated.map(tab => ({
            ...tab,
            bookmarked: false
          })));
        }
        return updated;
      });
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  }, [isEnabled, updateTabs]);

  const updateTabInfo = useCallback(async (
    tabId: number,
    updates: Partial<Pick<Tab, 'customTitle' | 'description' | 'tags'>>
  ) => {
    setTabs(prev => {
      const updated = prev.map(t =>
        t.id === tabId ? { ...t, ...updates } : t
      );
      if (isEnabled) {
        updateTabs(updated.map(tab => ({
          ...tab,
          bookmarked: false
        })));
      }
      return updated;
    });
  }, [isEnabled, updateTabs]);

  const suspendTab = useCallback(async (tabId: number) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      // Store tab info before suspending
      const suspendUrl = `suspended.html?url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title)}`;
      await browser.tabs.update(tabId, { url: suspendUrl });
      
      setTabs(prev => {
        const updated = prev.map(t =>
          t.id === tabId ? { ...t, suspended: true } : t
        );
        if (isEnabled) {
          updateTabs(updated.map(tab => ({
            ...tab,
            bookmarked: false
          })));
        }
        return updated;
      });
    } catch (error) {
      console.error('Error suspending tab:', error);
    }
  }, [tabs, isEnabled, updateTabs]);

  const unsuspendTab = useCallback(async (tabId: number) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      const url = new URL(tab.url);
      const originalUrl = url.searchParams.get('url');
      if (originalUrl) {
        await browser.tabs.update(tabId, { url: originalUrl });
        
        setTabs(prev => {
          const updated = prev.map(t =>
            t.id === tabId ? { ...t, suspended: false } : t
          );
          if (isEnabled) {
            updateTabs(updated.map(tab => ({
              ...tab,
              bookmarked: false
            })));
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('Error unsuspending tab:', error);
    }
  }, [tabs, isEnabled, updateTabs]);

  return {
    tabs,
    activeTab,
    groups,
    loading,
    switchToTab,
    closeTab,
    updateTabInfo,
    suspendTab,
    unsuspendTab,
  };
} 