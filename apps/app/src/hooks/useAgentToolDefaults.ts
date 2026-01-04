import { useEffect, useRef } from "react";

import { useToolsStore } from "~/state/stores/toolsStore";
import type { ChatMode } from "~/types";

type AgentWithTools = {
	id: string;
	enabled_tools?: string[] | string | null;
};

const normalizeAgentTools = (tools: unknown): string[] | null => {
	if (Array.isArray(tools)) {
		return tools.filter((tool) => typeof tool === "string");
	}
	if (typeof tools === "string" && tools.trim().length > 0) {
		try {
			const parsed = JSON.parse(tools);
			if (Array.isArray(parsed)) {
				return parsed.filter((tool) => typeof tool === "string");
			}
		} catch {
			return null;
		}
	}
	return null;
};

export const useAgentToolDefaults = ({
	agents,
	selectedAgentId,
	chatMode,
}: {
	agents: AgentWithTools[];
	selectedAgentId: string | null;
	chatMode: ChatMode;
}) => {
	const { selectedTools, setSelectedTools, resetToDefaults, defaultTools } =
		useToolsStore();
	const previousAgentIdRef = useRef<string | null>(null);
	const pendingResetRef = useRef(false);

	const arraysEqual = (left: string[], right: string[]) => {
		if (left.length !== right.length) return false;
		for (let i = 0; i < left.length; i += 1) {
			if (left[i] !== right[i]) return false;
		}
		return true;
	};

	useEffect(() => {
		const isAgentMode = chatMode === "agent" && selectedAgentId;
		const previousAgentId = previousAgentIdRef.current;

		if (isAgentMode) {
			pendingResetRef.current = false;
			const agent = agents.find((a) => a.id === selectedAgentId);
			const agentTools = normalizeAgentTools(agent?.enabled_tools);
			if (agentTools && agentTools.length > 0) {
				if (!arraysEqual(selectedTools, agentTools)) {
					setSelectedTools(agentTools);
				}
			} else if (defaultTools.length > 0) {
				if (!arraysEqual(selectedTools, defaultTools)) {
					resetToDefaults();
				}
			} else {
				if (selectedTools.length > 0) {
					setSelectedTools([]);
				}
			}
		} else if (previousAgentId) {
			if (defaultTools.length > 0) {
				if (!arraysEqual(selectedTools, defaultTools)) {
					resetToDefaults();
				}
				pendingResetRef.current = false;
			} else {
				pendingResetRef.current = true;
			}
		} else if (pendingResetRef.current && defaultTools.length > 0) {
			if (!arraysEqual(selectedTools, defaultTools)) {
				resetToDefaults();
			}
			pendingResetRef.current = false;
		}

		previousAgentIdRef.current = selectedAgentId;
	}, [
		agents,
		chatMode,
		defaultTools,
		resetToDefaults,
		selectedAgentId,
		selectedTools,
		setSelectedTools,
	]);
};
