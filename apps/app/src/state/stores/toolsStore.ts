import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Tool {
  id: string;
  name: string;
  description: string;
}

interface ToolsStore {
  selectedTools: string[];
  setSelectedTools: (toolIds: string[]) => void;
  toggleTool: (toolId: string) => void;
  isToolEnabled: (toolId: string) => boolean;
  readonly defaultTools: string[];
  resetToDefaults: () => void;
}

export const useToolsStore = create<ToolsStore>()(
  persist(
    (set, get) => ({
      defaultTools: ["web_search", "tutor"],
      selectedTools: ["web_search", "tutor"],
      setSelectedTools: (toolIds) => set({ selectedTools: toolIds }),
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
      resetToDefaults: () => {
        set({ selectedTools: [...get().defaultTools] });
      },
    }),
    {
      name: "tools-store",
    },
  ),
);
