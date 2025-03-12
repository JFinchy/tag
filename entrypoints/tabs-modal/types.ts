// Define the Tab interface
export interface Tab {
  id: number;
  title: string;
  url: string;
  originalUrl?: string;
  favIconUrl?: string;
  active: boolean;
  tags?: string[];
  labels?: string[];
  customTitle?: string | null;
  description?: string | null;
  isBookmark?: boolean;
  lastActiveTimestamp?: number;
  memoryUsage?: {
    jsHeapSizeUsed?: number;
    privateMemory?: number;
  };
  suspended?: boolean;
  suspendedUrl?: string; // Store the original URL when suspended
  lastSuspendedTimestamp?: number;
}

// Define props for the App component
export interface AppProps {
  initialTabs: Tab[];
}

// Define props for the TabsList component
export interface TabsListProps {
  tabs: Tab[];
  onTabClick: (tabId: number) => void;
  selectedTabIds?: number[];
  onRemoveTag?: (tabId: number, tag: string) => void;
  onEditTab?: (tab: Tab) => void;
  focusedTabIndex?: number;
}

export interface TagStats {
  tag: string;
  lastActiveTimestamp: number;
  itemCount: number;
  items: {
    id: number;
    title: string;
    lastActiveTimestamp: number;
  }[];
}

// Add suspension settings interfaces
export interface SuspensionRule {
  type: "domain" | "path";
  value: string;
  action: "never" | "faster" | "normal";
  expiresAt?: number;
}

export interface SuspensionSettings {
  enabled: boolean;
  defaultDelay: number; // Minutes until suspension
  memoryThreshold: number; // Bytes - tabs using more memory will be suspended faster
  fasterDelay: number; // Minutes until suspension for high-memory tabs
  rules: SuspensionRule[];
}

// Update TabsData interface
export interface TabsData {
  tabsData: Record<
    number,
    {
      tags?: string[];
      customTitle?: string;
      description?: string;
      lastActiveTimestamp?: number;
      suspended?: boolean;
      suspendedUrl?: string;
      lastSuspendedTimestamp?: number;
    }
  >;
  tagStats: Record<
    string,
    {
      lastActiveTimestamp: number;
      itemCount: number;
    }
  >;
  suspensionSettings?: SuspensionSettings;
}
