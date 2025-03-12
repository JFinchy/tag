import type { Browser } from 'webextension-polyfill';

declare global {
  interface WxtBrowser extends Browser {
    processes?: {
      getProcessInfo(tabIds: number[]): Promise<{
        id: number;
        privateMemory?: number;
        jsMemoryUsed?: number;
      }[]>;
    };
  }

  interface Window {
    browser: WxtBrowser;
  }
}

export {}; 