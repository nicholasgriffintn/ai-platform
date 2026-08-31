import { isModelToolId } from "@ngriffin_uk/polychat-library-chat/model-tools";
import type { ToolSelectionMode } from "@ngriffin_uk/polychat-schemas";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ToolsStore {
  /**
   * Hosted model tools the person switched on, plus any function tools a configured surface (an
   * agent, a recipe launch, a suggestion) asked for. Everyday function tools are the server's job.
   */
  selectedTools: string[];
  setSelectedTools: (toolIds: string[]) => void;
  toggleTool: (toolId: string) => void;
  isToolEnabled: (toolId: string) => boolean;
  toolSelectionMode: ToolSelectionMode;
  setToolSelectionMode: (mode: ToolSelectionMode) => void;
}

export const useToolsStore = create<ToolsStore>()(
  persist(
    (set, get) => ({
      selectedTools: [],
      toolSelectionMode: "managed",
      setSelectedTools: (toolIds) => set({ selectedTools: toolIds }),
      setToolSelectionMode: (mode) => set({ toolSelectionMode: mode }),
      toggleTool: (toolId) => {
        const currentTools = get().selectedTools;

        if (currentTools.includes(toolId)) {
          set({ selectedTools: currentTools.filter((id) => id !== toolId) });
        } else {
          set({ selectedTools: [...currentTools, toolId] });
        }
      },
      isToolEnabled: (toolId) => {
        return get().selectedTools.includes(toolId);
      },
    }),
    {
      name: "tools-store",
      version: 1,
      // Selections made in the old tool picker are stale once the server owns function tools, so
      // only the hosted model toggles survive the upgrade.
      migrate: (persistedState) => {
        const previous = persistedState as { selectedTools?: unknown } | undefined;
        const selectedTools = Array.isArray(previous?.selectedTools)
          ? previous.selectedTools.filter(
              (toolId): toolId is string => typeof toolId === "string" && isModelToolId(toolId),
            )
          : [];

        return { selectedTools, toolSelectionMode: "managed" as const };
      },
    },
  ),
);
