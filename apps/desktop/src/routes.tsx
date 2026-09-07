import type { ComponentType } from "react";
import { Route, Routes } from "react-router";

import { DESKTOP_LAYOUTS } from "./layouts";
import { readPageComponents } from "./pages/registry";
import { DESKTOP_ROUTE_DEFINITIONS, type DesktopRouteDefinition } from "./route-definitions";

const COMPONENTS = new Map(
  readPageComponents(
    import.meta.glob<{ default: ComponentType }>("./pages/*/page.tsx", { eager: true }),
  ).map(({ page, Page }) => [page, Page]),
);

function renderRoute({ path, page }: DesktopRouteDefinition) {
  const Page = COMPONENTS.get(page);

  return Page ? <Route key={path} path={path} element={<Page />} /> : null;
}

function groupByLayout(definitions: readonly DesktopRouteDefinition[]) {
  const grouped = new Map<string, DesktopRouteDefinition[]>();

  for (const definition of definitions) {
    const key = definition.layout && DESKTOP_LAYOUTS[definition.layout] ? definition.layout : "";

    grouped.set(key, [...(grouped.get(key) ?? []), definition]);
  }

  return grouped;
}

export function DesktopRoutes() {
  const grouped = groupByLayout(DESKTOP_ROUTE_DEFINITIONS);

  return (
    <Routes>
      {(grouped.get("") ?? []).map(renderRoute)}
      {[...grouped.entries()]
        .filter(([layout]) => layout !== "")
        .map(([layout, definitions]) => {
          const Layout = DESKTOP_LAYOUTS[layout];

          return (
            <Route key={layout} element={<Layout />}>
              {definitions.map(renderRoute)}
            </Route>
          );
        })}
    </Routes>
  );
}
