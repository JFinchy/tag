import "./style.css";

import App from "./tabs-modal/App";
import React from "react";
import ReactDOM from "react-dom/client";
import { createShadowRootUi } from "wxt/client";

// Define the Tab interface
interface Tab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  tags?: string[];
  labels?: string[];
}

// Define props for the App component
interface AppProps {
  initialTabs: Tab[];
}

// export default defineContentScript({
//   matches: ["http://localhost/*"],
//   main(ctx) {
//     console.log(ctx);
// browser.tabs.onActivated.addListener(async (message) => {
//   console.log(message);
//   await browser.runtime.sendMessage({ hello: "world" });
// });

//     browser.runtime.onMessage.addListener(async (message) => {
//       console.log("Content script received message:", message);
//       return Math.random();
//     });
//   },
// });
export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    // Function to fetch tabs from the background script
    const fetchTabs = async (): Promise<Tab[]> => {
      try {
        // Request tabs from the background script
        const tabs = await browser.runtime.sendMessage({ action: "getTabs" });
        return tabs || [];
      } catch (error) {
        console.error("Error fetching tabs:", error);
        return [];
      }
    };

    // Initial tabs data
    const initialTabs = await fetchTabs();

    const ui = await createShadowRootUi(ctx, {
      name: "wxt-react-example",
      position: "inline",
      anchor: "body",
      append: "first",
      onMount: (container) => {
        // Don't mount react app directly on <body>
        const wrapper = document.createElement("div");
        container.append(wrapper);

        const root = ReactDOM.createRoot(wrapper);
        // Pass the tabs data to the App component as props
        root.render(React.createElement(App, { initialTabs } as AppProps));
        return { root, wrapper };
      },
      onRemove: (elements) => {
        elements?.root.unmount();
        elements?.wrapper.remove();
      },
    });

    ui.mount();

    // Listen for messages from the background script
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
  },
});
