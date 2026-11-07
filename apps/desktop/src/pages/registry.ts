import type { ComponentType } from "react";

export interface DesktopPageRoutes {
  page: string;
  paths: readonly string[];
  layout?: string;
}

export type DesktopPageLoader = () => Promise<{ default: ComponentType }>;

export interface DesktopPageModule {
  page: string;
  load: DesktopPageLoader;
}

function directoryName(file: string): string {
  return file.split("/").at(-2) ?? file;
}

function byPage<T extends { page: string }>(entries: T[]): T[] {
  return entries.sort((left, right) => left.page.localeCompare(right.page));
}

export function readPageNames(modules: Record<string, unknown>): string[] {
  return Object.keys(modules)
    .map(directoryName)
    .sort((left, right) => left.localeCompare(right));
}

export function readPageRoutes(
  modules: Record<string, { paths: readonly string[]; layout?: string }>,
): DesktopPageRoutes[] {
  return byPage(
    Object.entries(modules).map(([file, module]) => ({
      page: directoryName(file),
      paths: module.paths,
      ...(module.layout ? { layout: module.layout } : {}),
    })),
  );
}

export function readPageModules(modules: Record<string, DesktopPageLoader>): DesktopPageModule[] {
  return byPage(
    Object.entries(modules).map(([file, load]) => ({
      page: directoryName(file),
      load,
    })),
  );
}
