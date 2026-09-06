import { setModelSurface } from "@ngriffin_uk/polychat-library-chat";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import "./styles/styles.css";
import { App } from "./App";
import "./lib/desktop-backend";
import "./lib/sqlite-conversation-store";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Polychat desktop could not find its root element.");
}

setModelSurface("desktop");

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
