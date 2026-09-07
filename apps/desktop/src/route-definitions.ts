import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";

import { readPageRoutes, type DesktopPageRoutes } from "./pages/registry";

export const NOT_FOUND_PAGE = "not-found";

const UNBUILT_CHAT_PATHS = [
  "attention",
  "files/*",
  "teammates",
  "teammates/:teammateId",
  "apps/:appId/*",
  "tools/:toolId",
];

export interface DesktopRouteDefinition {
  path: string;
  page: string;
}

export function buildRouteDefinitions(
  pages: readonly DesktopPageRoutes[],
): DesktopRouteDefinition[] {
  const built = new Set(pages.flatMap(({ paths }) => paths));

  return [
    ...pages.flatMap(({ page, paths }) => paths.map((path) => ({ path, page }))),
    ...UNBUILT_CHAT_PATHS.map((path) => `${MODE_BASE_PATHS.chat}/${path}`)
      .filter((path) => !built.has(path))
      .map((path) => ({ path, page: NOT_FOUND_PAGE })),
  ];
}

export const DESKTOP_PAGE_ROUTES = readPageRoutes(
  import.meta.glob<{ paths: readonly string[] }>("./pages/*/routes.ts", { eager: true }),
);

export const DESKTOP_ROUTE_DEFINITIONS: readonly DesktopRouteDefinition[] =
  buildRouteDefinitions(DESKTOP_PAGE_ROUTES);
