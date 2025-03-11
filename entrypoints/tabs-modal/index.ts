import "./style.css";
import "uno.css";

import App from "./App";
import React from "react";
import ReactDOM from "react-dom/client";
import { createShadowRootUi } from "wxt/client";

// WXT provides defineContentScript globally
export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "wxt-tabs-modal",
      position: "inline",
      anchor: "body",
      append: "first",
      onMount: (container) => {
        // Don't mount react app directly on <body>
        const wrapper = document.createElement("div");
        container.append(wrapper);

        const root = ReactDOM.createRoot(wrapper);
        root.render(React.createElement(App));
        return { root, wrapper };
      },
      onRemove: (elements) => {
        elements?.root.unmount();
        elements?.wrapper.remove();
      },
    });

    ui.mount();

    // Listen for keyboard shortcut (Cmd+K or Ctrl+K)
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // The modal visibility is handled within the React component
      }
    });
  },
});
