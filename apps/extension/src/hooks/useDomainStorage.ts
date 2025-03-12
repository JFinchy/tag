import { useEffect, useState, useCallback } from 'react';
import { createDomainStorage, type TabData, type StorageOptions } from '../utils/domainStorage';

export function useDomainStorage(url: string, options?: StorageOptions) {
  const [storage, setStorage] = useState(() => createDomainStorage(url, options));
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [bookmarks, setBookmarks] = useState<TabData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!storage) {
        setLoading(false);
        return;
      }

      try {
        const [tabsData, bookmarksData] = await Promise.all([
          storage.getTabs(),
          storage.getBookmarks(),
        ]);

        setTabs(tabsData);
        setBookmarks(bookmarksData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load data'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [storage]);

  // Update tabs
  const updateTabs = useCallback(async (newTabs: TabData[]) => {
    if (!storage) return;

    try {
      await storage.storeTabs(newTabs);
      setTabs(newTabs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update tabs'));
    }
  }, [storage]);

  // Update bookmarks
  const updateBookmarks = useCallback(async (newBookmarks: TabData[]) => {
    if (!storage) return;

    try {
      await storage.storeBookmarks(newBookmarks);
      setBookmarks(newBookmarks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update bookmarks'));
    }
  }, [storage]);

  // Update settings
  const updateSettings = useCallback(async <T>(key: string, value: T) => {
    if (!storage) return;

    try {
      await storage.storeSettings(key, value);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update settings'));
    }
  }, [storage]);

  // Get settings
  const getSettings = useCallback(async <T>(key: string): Promise<T | null> => {
    if (!storage) return null;

    try {
      const value = await storage.getSettings<T>(key);
      setError(null);
      return value;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get settings'));
      return null;
    }
  }, [storage]);

  // Clear all data
  const clearAll = useCallback(async () => {
    if (!storage) return;

    try {
      await storage.clear();
      setTabs([]);
      setBookmarks([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to clear data'));
    }
  }, [storage]);

  return {
    isEnabled: !!storage,
    tabs,
    bookmarks,
    loading,
    error,
    updateTabs,
    updateBookmarks,
    updateSettings,
    getSettings,
    clearAll,
  };
} 