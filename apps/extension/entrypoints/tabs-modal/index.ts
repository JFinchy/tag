import "./style.css";
import "uno.css";

import App from "./App";
import React from 'react';
import type { Tab } from '../../src/types';
import { browser } from 'wxt/browser';
import { createRoot } from "react-dom/client";
import { createShadowRootUi } from "wxt/client";

interface TabsMessage {
  action: 'tabsUpdated' | 'getTabs';
  tabs?: Tab[];
}

// Function to fetch initial tabs
async function fetchInitialTabs(): Promise<Tab[]> {
  console.log('Fetching initial tabs...');
  try {
    const response = await browser.runtime.sendMessage({ action: "getTabs" }) as Tab[];
    console.log('Received initial tabs:', response);
    return response || [];
  } catch (error) {
    console.error("Error fetching initial tabs:", error);
    return [];
  }
}

// WXT provides defineContentScript globally
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  cssInjectionMode: "ui",

  async main(ctx) {
    console.log('Content script starting...');
    
    // Create root element for React
    const root = document.createElement('div');
    root.id = 'tag-extension-root';
    document.body.appendChild(root);

    // Create React root and render app
    const reactRoot = createRoot(root);
    
    // Fetch initial tabs
    const initialTabs = await fetchInitialTabs();
    console.log('Initial tabs loaded:', initialTabs);

    // Render app using JSX
    reactRoot.render(
      React.createElement(App, { initialTabs: initialTabs })
    );
    console.log('App rendered');

    // Listen for tab updates
    browser.runtime.onMessage.addListener((message: unknown) => {
      console.log('Received message:', message);
      const tabMessage = message as TabsMessage;
      if (tabMessage.action === 'tabsUpdated' && tabMessage.tabs) {
        console.log('Received updated tabs:', tabMessage.tabs);
        window.postMessage({ type: 'tabsUpdated', tabs: tabMessage.tabs }, '*');
      }
      return true;
    });

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        window.close();
      }
    });
  },
});
