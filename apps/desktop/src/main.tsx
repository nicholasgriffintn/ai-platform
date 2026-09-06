import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { tauriDesktopBackend } from "./desktop-backend";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Polychat desktop could not find its root element.");
}

createRoot(container).render(
  <StrictMode>
    <App backend={tauriDesktopBackend} />
  </StrictMode>,
);
