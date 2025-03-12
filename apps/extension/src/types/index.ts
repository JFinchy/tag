import type { Browser, Tabs } from 'webextension-polyfill';

export interface MemoryUsage {
  privateMemory: number;
  jsHeapSizeUsed: number;
}

export interface Tab extends Omit<Tabs.Tab, 'id'> {
  id?: number;
  processId?: number;
  bookmarked: boolean;
  memoryInfo?: {
    privateMemory?: number;
    jsMemoryUsed?: number;
  };
}

export interface ProcessInfo {
  id: number;
  privateMemory?: number;
  jsMemoryUsed?: number;
}

export interface Message {
  action: string;
  tabs?: Tab[];
}

declare global {
  interface Window {
    browser: Browser & {
      processes?: {
        getProcessInfo(tabIds: number[]): Promise<Record<number, {
          privateMemory?: number;
          jsHeapSizeUsed?: number;
        }>>;
      };
    };
  }
}

export type { Browser }; 