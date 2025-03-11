import "virtual:uno.css";

import { GlobalProvider } from "../../src/app/store";
import { Page } from "../../src/pages";
import React from "react";
import ReactDOM from "react-dom/client";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalProvider>
      <Page />
    </GlobalProvider>
  </React.StrictMode>,
);
