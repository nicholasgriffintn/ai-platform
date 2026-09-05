import {
  PROJECT_WORKBENCH_PANES,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useEffect, useState } from "react";

const DEFAULT_DOCK_WIDTH = 440;
const STORAGE_KEY = "polychat:project-workbench-layout";

interface ProjectWorkbenchPreferences {
  selectedPane: ProjectWorkbenchPane;
  dockCollapsed: boolean;
  dockWidth: number;
}

function readPreferences(): ProjectWorkbenchPreferences {
  const defaults: ProjectWorkbenchPreferences = {
    selectedPane: "activity",
    dockCollapsed: false,
    dockWidth: DEFAULT_DOCK_WIDTH,
  };

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");

    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return defaults;
    }

    const selectedPane = PROJECT_WORKBENCH_PANES.find(
      (pane) => pane === Reflect.get(stored, "selectedPane"),
    );
    const dockCollapsed = Reflect.get(stored, "dockCollapsed");
    const dockWidth = Reflect.get(stored, "dockWidth");

    return {
      selectedPane: selectedPane ?? defaults.selectedPane,
      dockCollapsed: typeof dockCollapsed === "boolean" ? dockCollapsed : defaults.dockCollapsed,
      dockWidth:
        typeof dockWidth === "number" && Number.isFinite(dockWidth)
          ? Math.min(720, Math.max(320, dockWidth))
          : defaults.dockWidth,
    };
  } catch {
    return defaults;
  }
}

export function useProjectWorkbenchPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      return;
    }
  }, [preferences]);

  return {
    ...preferences,
    setSelectedPane: (selectedPane: ProjectWorkbenchPane) =>
      setPreferences((current) => ({ ...current, selectedPane })),
    setDockCollapsed: (dockCollapsed: boolean) =>
      setPreferences((current) => ({ ...current, dockCollapsed })),
    setDockWidth: (dockWidth: number) => setPreferences((current) => ({ ...current, dockWidth })),
  };
}
