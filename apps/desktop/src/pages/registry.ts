import type { ComponentType } from "react";

export interface DesktopPageRoute {
  path: string;
  layout?: string;
}

export type DesktopPagePath = string | DesktopPageRoute;

export interface DesktopPageRoutesModule {
  paths: readonly DesktopPagePath[];
  layout?: string;
}

export interface DesktopPageRoutes {
  page: string;
  routes: readonly DesktopPageRoute[];
}

export interface DesktopPageComponent {
  page: string;
  Page: ComponentType;
}

function directoryName(file: string): string {
  return file.split("/").at(-2) ?? file;
}

function byPage<T extends { page: string }>(entries: T[]): T[] {
  return entries.sort((left, right) => left.page.localeCompare(right.page));
}

function toRoute(entry: DesktopPagePath, defaultLayout: string | undefined): DesktopPageRoute {
  const route = typeof entry === "string" ? { path: entry } : entry;
  const layout = route.layout ?? defaultLayout;

  return layout ? { path: route.path, layout } : { path: route.path };
}

export function readPageNames(modules: Record<string, unknown>): string[] {
  return Object.keys(modules)
    .map(directoryName)
    .sort((left, right) => left.localeCompare(right));
}

export function readPageRoutes(
  modules: Record<string, DesktopPageRoutesModule>,
): DesktopPageRoutes[] {
  return byPage(
    Object.entries(modules).map(([file, module]) => ({
      page: directoryName(file),
      routes: module.paths.map((entry) => toRoute(entry, module.layout)),
    })),
  );
}

export function readPageComponents(
  modules: Record<string, { default: ComponentType }>,
): DesktopPageComponent[] {
  return byPage(
    Object.entries(modules).map(([file, module]) => ({
      page: directoryName(file),
      Page: module.default,
    })),
  );
}
