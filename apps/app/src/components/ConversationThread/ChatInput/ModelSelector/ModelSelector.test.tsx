import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelSelector } from ".";

const store = {
	autoMode: "max" as const,
	chatMode: "remote",
	chatSettings: {
		temperature: 0.7,
		top_p: 0.8,
		max_tokens: 2048,
		presence_penalty: 0,
		frequency_penalty: 0,
		use_rag: false,
	},
	isPro: true,
	model: null as string | null,
	selectedAgentId: null as string | null,
	setAutoMode: vi.fn(),
	setChatMode: vi.fn(),
	setChatSettings: vi.fn(),
	setModel: vi.fn(),
	setSelectedAgentId: vi.fn(),
};

vi.mock("~/hooks/useAgents", () => ({
	useAgents: () => ({ chatAgents: [] }),
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({
		data: {
			"gpt-5.4": {
				id: "gpt-5.4",
				matchingModel: "gpt-5.4",
				name: "GPT-5.4",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				isFree: true,
				includedInRouter: true,
			},
		},
		isLoading: false,
	}),
}));

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({ trackEvent: vi.fn() }),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: () => ({}),
}));

vi.mock("~/state/contexts/LoadingContext", () => ({
	useIsLoading: () => false,
	useLoadingMessage: () => "",
	useLoadingProgress: () => undefined,
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => store,
}));

vi.mock("~/state/stores/uiStore", () => ({
	useUIStore: () => ({ isMobile: false }),
}));

describe("ModelSelector", () => {
	beforeEach(() => {
		store.autoMode = "max";
		store.chatMode = "remote";
		store.model = null;
		store.selectedAgentId = null;
		store.setAutoMode.mockReset();
		store.setChatMode.mockReset();
		store.setChatSettings.mockReset();
		store.setModel.mockReset();
		store.setSelectedAgentId.mockReset();
	});

	it("uses the selected auto mode icon in the closed trigger", () => {
		render(<ModelSelector />);

		const trigger = screen.getByRole("button", { name: "Select a model" });

		expect(within(trigger).getByText("Max auto")).toBeInTheDocument();
		expect(within(trigger).getByLabelText("Max automatic mode icon")).toBeInTheDocument();
	});

	it("closes when the open trigger body is clicked", () => {
		render(<ModelSelector />);

		const trigger = screen.getByRole("button", { name: "Select a model" });

		fireEvent.click(trigger);
		expect(screen.getByRole("dialog", { name: "Model selection dialog" })).toBeInTheDocument();

		fireEvent.mouseDown(trigger);
		fireEvent.click(trigger);

		expect(
			screen.queryByRole("dialog", { name: "Model selection dialog" }),
		).not.toBeInTheDocument();
	});
});
