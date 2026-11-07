import { type ComponentType, lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

import { DESKTOP_LAYOUTS } from "./layouts";
import { readPageModules } from "./pages/registry";
import {
  DESKTOP_ROUTE_DEFINITIONS,
  type DesktopRouteDefinition,
  readPageForPath,
} from "./route-definitions";

const LOADERS = new Map(
  readPageModules(import.meta.glob<{ default: ComponentType }>("./pages/*/page.tsx")).map(
    ({ page, load }) => [page, load],
  ),
);
const COMPONENTS = new Map([...LOADERS].map(([page, load]) => [page, lazy(load)]));

export async function preloadPage(pathname: string): Promise<void> {
  await LOADERS.get(readPageForPath(pathname) ?? "")?.();
}

function renderRoute({ path, page }: DesktopRouteDefinition) {
  const Page = COMPONENTS.get(page);

  return Page ? (
    <Route
      key={path}
      path={path}
      element={
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      }
    />
  ) : null;
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
