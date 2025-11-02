import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Tool {
	id: string;
	name: string;
	description: string;
	isDefault?: boolean;
}

interface ToolsStore {
	selectedTools: string[];
	setSelectedTools: (toolIds: string[]) => void;
	toggleTool: (toolId: string) => void;
	isToolEnabled: (toolId: string) => boolean;
	defaultTools: string[];
	setDefaultTools: (tools: Tool[]) => void;
	resetToDefaults: () => void;
}

export const useToolsStore = create<ToolsStore>()(
	persist(
		(set, get) => ({
			defaultTools: [],
			selectedTools: [],
			setSelectedTools: (toolIds) => set({ selectedTools: toolIds }),
			setDefaultTools: (tools) => {
				const defaults = tools.filter((t) => t.isDefault).map((t) => t.id);
				set({ defaultTools: defaults });
				if (get().selectedTools.length === 0) {
					set({ selectedTools: defaults });
				}
			},
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
