import type { ComponentType } from "react";
import { Route, Routes } from "react-router";

import { readPageComponents } from "./pages/registry";
import { DESKTOP_ROUTE_DEFINITIONS } from "./route-definitions";

const COMPONENTS = new Map(
  readPageComponents(
    import.meta.glob<{ default: ComponentType }>("./pages/*/page.tsx", { eager: true }),
  ).map(({ page, Page }) => [page, Page]),
);

export function DesktopRoutes() {
  return (
    <Routes>
      {DESKTOP_ROUTE_DEFINITIONS.map(({ path, page }) => {
        const Page = COMPONENTS.get(page);

        return Page ? <Route key={path} path={path} element={<Page />} /> : null;
      })}
    </Routes>
  );
}
