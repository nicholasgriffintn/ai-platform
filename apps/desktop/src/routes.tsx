import { NotFoundPage } from "@ngriffin_uk/polychat-component-shell";
import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";
import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router";

import { ChatPage } from "./pages/ChatPage";
import { DESKTOP_ROUTE_DEFINITIONS, type DesktopPage } from "./route-definitions";

const PAGES: Record<DesktopPage, () => ReactElement> = {
  "redirect-to-chat": () => <Navigate to={MODE_BASE_PATHS.chat} replace />,
  chat: () => <ChatPage />,
  "not-found": () => <NotFoundPage />,
};

export function DesktopRoutes() {
  return (
    <Routes>
      {DESKTOP_ROUTE_DEFINITIONS.map(({ path, page }) => (
        <Route key={path} path={path} element={PAGES[page]()} />
      ))}
    </Routes>
  );
}
