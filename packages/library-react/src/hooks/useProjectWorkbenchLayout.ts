import {
  openProjectWorkbenchPane,
  PROJECT_WORKBENCH_MAX_OPEN_PANES,
  PROJECT_WORKBENCH_PANES,
  type ProjectWorkbenchLayout,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-utility-react";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_COLUMN_WIDTH = 440;
const MIN_COLUMN_WIDTH = 320;
const MAX_COLUMN_WIDTH = 720;

interface StoredLayout {
  contextOpen: boolean;
  openPanes: ProjectWorkbenchPane[];
  columnWidth: number;
}

const DEFAULT_LAYOUT: StoredLayout = {
  contextOpen: true,
  openPanes: [],
  columnWidth: DEFAULT_COLUMN_WIDTH,
};

function isProjectWorkbenchPane(value: unknown): value is ProjectWorkbenchPane {
  return PROJECT_WORKBENCH_PANES.some((pane) => pane === value);
}

function readLayout(storageKey: string): StoredLayout {
  if (typeof window === "undefined") {
    return DEFAULT_LAYOUT;
  }

  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");

    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return DEFAULT_LAYOUT;
    }

    const contextOpen = Reflect.get(stored, "contextOpen");
    const openPanes = Reflect.get(stored, "openPanes");
    const columnWidth = Reflect.get(stored, "columnWidth");

    return {
      contextOpen: typeof contextOpen === "boolean" ? contextOpen : DEFAULT_LAYOUT.contextOpen,
      openPanes: Array.isArray(openPanes)
        ? openPanes.filter(isProjectWorkbenchPane).slice(-PROJECT_WORKBENCH_MAX_OPEN_PANES)
        : DEFAULT_LAYOUT.openPanes,
      columnWidth:
        typeof columnWidth === "number" && Number.isFinite(columnWidth)
          ? Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, columnWidth))
          : DEFAULT_LAYOUT.columnWidth,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function useProjectWorkbenchLayout(storageKey: string): ProjectWorkbenchLayout {
  const [layout, setLayout] = useState(() => readLayout(storageKey));

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      return;
    }
  }, [layout, storageKey]);

  const actions = useMemo(
    () => ({
      setContextOpen: (contextOpen: boolean) =>
        setLayout((current) => ({ ...current, contextOpen })),
      openPane: (pane: ProjectWorkbenchPane) =>
        setLayout((current) => ({
          ...current,
          openPanes: openProjectWorkbenchPane(current.openPanes, pane),
        })),
      closePane: (pane: ProjectWorkbenchPane) =>
        setLayout((current) => ({
          ...current,
          openPanes: current.openPanes.filter((candidate) => candidate !== pane),
        })),
      setColumnWidth: (columnWidth: number) =>
        setLayout((current) => ({
          ...current,
          columnWidth: Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, columnWidth)),
        })),
    }),
    [],
  );

  return { ...layout, ...actions };
}
