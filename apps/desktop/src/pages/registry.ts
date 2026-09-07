import type { ComponentType } from "react";

export interface DesktopPageRoutes {
  page: string;
  paths: readonly string[];
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

export function readPageNames(modules: Record<string, unknown>): string[] {
  return Object.keys(modules)
    .map(directoryName)
    .sort((left, right) => left.localeCompare(right));
}

export function readPageRoutes(
  modules: Record<string, { paths: readonly string[] }>,
): DesktopPageRoutes[] {
  return byPage(
    Object.entries(modules).map(([file, module]) => ({
      page: directoryName(file),
      paths: module.paths,
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
