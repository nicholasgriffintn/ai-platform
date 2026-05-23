import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useComposerCommandController } from "./useComposerCommandController";

const mocks = vi.hoisted(() => ({
	store: {
		chatInput: "/c",
		chatMode: "remote",
		chatSettings: {},
		isPro: true,
		model: null as string | null,
		selectedAgentId: null as string | null,
		setChatInput: vi.fn(),
		setChatMode: vi.fn(),
		setChatSettings: vi.fn(),
		setModel: vi.fn(),
		setSelectedAgentId: vi.fn(),
		setUseMultiModel: vi.fn(),
		useMultiModel: false,
	},
}));

vi.mock("~/hooks/useAgents", () => ({
	useAgents: () => ({
		chatAgents: [],
		isLoadingAgents: false,
	}),
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({ data: {} }),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: () => ({}),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => mocks.store,
}));

describe("useComposerCommandController", () => {
	it("moves through slash suggestions with wraparound", () => {
		const first = vi.fn();
		const second = vi.fn();
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
				modeControls: {
					commands: [
						{
							id: "chat",
							label: "Chat",
							description: "Standard chat",
							command: "chat",
							icon: null,
							isActive: true,
							onSelect: first,
						},
						{
							id: "council",
							label: "Council",
							description: "Debate with council",
							command: "council",
							icon: null,
							isActive: false,
							onSelect: second,
						},
					],
				},
			}),
		);

		act(() => result.current.setTextareaCursorPosition(2));
		act(() => result.current.moveActiveSuggestion(1));
		act(() => result.current.applyDirectiveSelection());

		expect(second).toHaveBeenCalledTimes(1);
	});
});
