import { initSentry } from "@ngriffin_uk/polychat-library-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import "./styles/styles.css";
import { App } from "./App";
import "./infrastructure/desktop-backend";
import "./infrastructure/device-models";
import "./infrastructure/product-analytics";
import "./infrastructure/sqlite-conversation-store";

initSentry({ app: "desktop", release: __POLYCHAT_RELEASE__ });

const container = document.getElementById("root");

if (!container) {
  throw new Error("Polychat desktop could not find its root element.");
}

const queryClient = new QueryClient();

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
