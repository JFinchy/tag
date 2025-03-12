import { IDBPDatabase, openDB } from 'idb';

interface TabData {
  id: number;
  url: string;
  title: string;
  tags: string[];
  lastAccessed: number;
  bookmarked: boolean;
  customTitle?: string;
  description?: string;
}

interface StorageOptions {
  useIndexedDB: boolean;
}

class DomainStorage {
  private domain: string;
  private db: IDBPDatabase | null = null;
  private readonly useIndexedDB: boolean;

  constructor(domain: string, options: StorageOptions = { useIndexedDB: true }) {
    this.domain = domain;
    this.useIndexedDB = options.useIndexedDB;
    if (this.useIndexedDB) {
      this.initIndexedDB();
    }
  }

  private async initIndexedDB() {
    this.db = await openDB(`tabs-${this.domain}`, 1, {
      upgrade(db) {
        // Create stores for different data types
        if (!db.objectStoreNames.contains('tabs')) {
          db.createObjectStore('tabs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.createObjectStore('bookmarks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }

  private getStorageKey(type: string): string {
    return `${this.domain}-${type}`;
  }

  private async getBrowserStorage<T>(type: string): Promise<T | null> {
    const key = this.getStorageKey(type);
    const result = await browser.storage.local.get(key);
    return result[key] || null;
  }

  private async setBrowserStorage<T>(type: string, data: T): Promise<void> {
    const key = this.getStorageKey(type);
    await browser.storage.local.set({ [key]: data });
  }

  async storeTabs(tabs: TabData[]): Promise<void> {
    if (this.useIndexedDB && this.db) {
      const tx = this.db.transaction('tabs', 'readwrite');
      const store = tx.objectStore('tabs');
      await Promise.all(tabs.map(tab => store.put(tab)));
      await tx.done;
    } else {
      await this.setBrowserStorage('tabs', tabs);
    }
  }

  async getTabs(): Promise<TabData[]> {
    if (this.useIndexedDB && this.db) {
      return await this.db.getAll('tabs');
    }
    return await this.getBrowserStorage<TabData[]>('tabs') || [];
  }

  async storeBookmarks(bookmarks: TabData[]): Promise<void> {
    if (this.useIndexedDB && this.db) {
      const tx = this.db.transaction('bookmarks', 'readwrite');
      const store = tx.objectStore('bookmarks');
      await Promise.all(bookmarks.map(bookmark => store.put(bookmark)));
      await tx.done;
    } else {
      await this.setBrowserStorage('bookmarks', bookmarks);
    }
  }

  async getBookmarks(): Promise<TabData[]> {
    if (this.useIndexedDB && this.db) {
      return await this.db.getAll('bookmarks');
    }
    return await this.getBrowserStorage<TabData[]>('bookmarks') || [];
  }

  async storeSettings<T>(key: string, value: T): Promise<void> {
    if (this.useIndexedDB && this.db) {
      await this.db.put('settings', { key, value });
    } else {
      await this.setBrowserStorage(`settings-${key}`, value);
    }
  }

  async getSettings<T>(key: string): Promise<T | null> {
    if (this.useIndexedDB && this.db) {
      const setting = await this.db.get('settings', key);
      return setting ? setting.value : null;
    }
    return await this.getBrowserStorage<T>(`settings-${key}`);
  }

  async clear(): Promise<void> {
    if (this.useIndexedDB && this.db) {
      const tx = this.db.transaction(['tabs', 'bookmarks', 'settings'], 'readwrite');
      await Promise.all([
        tx.objectStore('tabs').clear(),
        tx.objectStore('bookmarks').clear(),
        tx.objectStore('settings').clear(),
      ]);
      await tx.done;
    } else {
      const keys = [
        this.getStorageKey('tabs'),
        this.getStorageKey('bookmarks'),
        // Clear all settings
        ...(await browser.storage.local.get()).keys()
          .filter(key => key.startsWith(`${this.domain}-settings-`))
      ];
      await browser.storage.local.remove(keys);
    }
  }
}

export function shouldUseDomainStorage(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'localhost' || 
           hostname.includes('127.0.0.1') || 
           hostname.includes('tags');
  } catch {
    return false;
  }
}

export function createDomainStorage(url: string, options?: StorageOptions): DomainStorage | null {
  if (!shouldUseDomainStorage(url)) {
    return null;
  }
  const hostname = new URL(url).hostname;
  return new DomainStorage(hostname, options);
}

export type { TabData, StorageOptions }; 