import "./style.css";
import "uno.css";

import App from "./App";
import React from "react";
import { createRoot } from "react-dom/client";
import { createShadowRootUi } from "wxt/client";

// Function to fetch initial tabs
async function fetchInitialTabs() {
  try {
    const response = await browser.runtime.sendMessage({ action: "getTabs" });
    return response || [];
  } catch (error) {
    console.error("Error fetching initial tabs:", error);
    return [];
  }
}

// WXT provides defineContentScript globally
export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    // Fetch initial tabs
    const initialTabs = await fetchInitialTabs();

    const ui = await createShadowRootUi(ctx, {
      name: "wxt-tabs-modal",
      position: "inline",
      anchor: "body",
      append: "first",
      onMount: (container) => {
        // Don't mount react app directly on <body>
        const wrapper = document.createElement("div");
        container.append(wrapper);

        const root = createRoot(wrapper);
        root.render(React.createElement(App, { initialTabs }));
        return { root, wrapper };
      },
      onRemove: (elements) => {
        elements?.root.unmount();
        elements?.wrapper.remove();
      },
    });

    ui.mount();

    // Set up tab update listener
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.action === "tabsUpdated" && message.tabs) {
        // Use a custom event to communicate with the React app
        document.dispatchEvent(
          new CustomEvent("tabs-updated", {
            detail: { tabs: message.tabs },
          }),
        );
      }
      return true; // Required to indicate we've handled the message
    });

    // Listen for keyboard shortcut (Cmd+K or Ctrl+K)
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // The App component handles visibility internally
      }
    });
  },
});
