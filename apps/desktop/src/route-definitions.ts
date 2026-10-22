import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";
import { matchRoutes } from "react-router";

import {
  readPageRoutes,
  type DesktopPageRoutes,
  type DesktopPageRoutesModule,
} from "./pages/registry";

export const NOT_FOUND_PAGE = "not-found";

const CHAT_PLACE_PATHS = [
  "attention",
  "files/*",
  "teammates",
  "teammates/:teammateId",
  "plugins",
  "apps/:appId/*",
  "tools/:toolId",
];

export interface DesktopRouteDefinition {
  path: string;
  page: string;
  layout?: string;
}

export function buildRouteDefinitions(
  pages: readonly DesktopPageRoutes[],
): DesktopRouteDefinition[] {
  const built = new Set(pages.flatMap(({ routes }) => routes.map(({ path }) => path)));

  return [
    ...pages.flatMap(({ page, routes }) => routes.map((route) => ({ ...route, page }))),
    ...CHAT_PLACE_PATHS.map((path) => `${MODE_BASE_PATHS.chat}/${path}`)
      .filter((path) => !built.has(path))
      .map((path) => ({ path, page: NOT_FOUND_PAGE })),
  ];
}

export const DESKTOP_PAGE_ROUTES = readPageRoutes(
  import.meta.glob<DesktopPageRoutesModule>("./pages/*/routes.ts", { eager: true }),
);

export const DESKTOP_ROUTE_DEFINITIONS: readonly DesktopRouteDefinition[] =
  buildRouteDefinitions(DESKTOP_PAGE_ROUTES);

export function readPageForPath(pathname: string): string | undefined {
  const matches = matchRoutes(
    DESKTOP_ROUTE_DEFINITIONS.map(({ path, page }) => ({ path, id: `${page}:${path}` })),
    pathname,
  );

  return matches?.at(-1)?.route.id?.split(":")[0];
}
