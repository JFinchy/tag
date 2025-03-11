// Define the Tab interface
export interface Tab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  tags?: string[];
  labels?: string[];
  customTitle?: string | null;
  description?: string | null;
  isBookmark?: boolean;
}

// Define props for the App component
export interface AppProps {
  initialTabs?: Tab[];
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
