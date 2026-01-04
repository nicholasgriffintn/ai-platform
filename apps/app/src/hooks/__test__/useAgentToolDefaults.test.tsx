import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentToolDefaults } from "../useAgentToolDefaults";

const mockStoreState = {
	defaultTools: [] as string[],
	selectedTools: [] as string[],
	setSelectedTools: vi.fn(),
	resetToDefaults: vi.fn(),
};

vi.mock("~/state/stores/toolsStore", () => ({
	useToolsStore: () => mockStoreState,
}));

describe("useAgentToolDefaults", () => {
	beforeEach(() => {
		mockStoreState.defaultTools = [];
		mockStoreState.selectedTools = [];
		mockStoreState.setSelectedTools.mockImplementation((tools: string[]) => {
			mockStoreState.selectedTools = tools;
		});
		mockStoreState.resetToDefaults.mockImplementation(() => {
			mockStoreState.selectedTools = [...mockStoreState.defaultTools];
		});
	});

	it("applies agent enabled_tools when in agent mode", () => {
		const agents = [{ id: "agent-1", enabled_tools: ["web_search"] }];

		renderHook(() =>
			useAgentToolDefaults({
				agents,
				selectedAgentId: "agent-1",
				chatMode: "agent",
			}),
		);

		expect(mockStoreState.setSelectedTools).toHaveBeenCalledWith([
			"web_search",
		]);
		expect(mockStoreState.resetToDefaults).not.toHaveBeenCalled();
	});

	it("resets to defaults when leaving agent mode", () => {
		mockStoreState.defaultTools = ["search_grounding"];
		const agents = [{ id: "agent-1", enabled_tools: ["web_search"] }];

		type Props = {
			chatMode: "agent" | "remote";
			selectedAgentId: string | null;
		};

		const { rerender } = renderHook(
			({ chatMode, selectedAgentId }: Props) =>
				useAgentToolDefaults({
					agents,
					selectedAgentId,
					chatMode,
				}),
			{
				initialProps: {
					chatMode: "agent",
					selectedAgentId: "agent-1",
				},
			},
		);

		rerender({ chatMode: "remote", selectedAgentId: null });

		expect(mockStoreState.resetToDefaults).toHaveBeenCalled();
	});
});
