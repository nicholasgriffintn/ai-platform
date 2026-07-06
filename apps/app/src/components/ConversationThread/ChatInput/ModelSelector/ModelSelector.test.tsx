import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelRouterMode } from "@assistant/schemas";
import { ModelSelector } from ".";

const store = {
	autoMode: "max" as ModelRouterMode,
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
				contextComplexity: 3,
				reliability: 4,
				speed: 4,
			},
			"paid-max": {
				id: "paid-max",
				matchingModel: "paid-max",
				name: "Paid Max",
				provider: "workers-ai",
				modalities: { input: ["text"], output: ["text"] },
				isFree: false,
				contextComplexity: 5,
				reliability: 5,
				speed: 2,
				artificialAnalysis: { intelligenceIndex: 45 },
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
		store.isPro = true;
		store.model = null;
		store.selectedAgentId = null;
		store.setAutoMode.mockReset();
		store.setChatMode.mockReset();
		store.setChatSettings.mockReset();
		store.setModel.mockReset();
		store.setSelectedAgentId.mockReset();
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

	it("switching to the auto tab clears an explicit model so router mode is sent", () => {
		store.autoMode = "pro";
		store.model = "deepseek-v4-flash";

		render(<ModelSelector />);

		fireEvent.click(screen.getByRole("button", { name: "Select a model" }));
		const autoTab = screen.getByRole("tab", { name: "Auto" });
		fireEvent.mouseDown(autoTab, { button: 0, ctrlKey: false });
		fireEvent.click(autoTab);

		expect(store.setChatMode).toHaveBeenCalledWith("remote");
		expect(store.setSelectedAgentId).toHaveBeenCalledWith(null);
		expect(store.setModel).toHaveBeenCalledWith(null);
	});

	it("disables paid-only automatic modes for non-pro users", () => {
		store.isPro = false;
		store.autoMode = "max";
		store.model = null;

		render(<ModelSelector />);

		fireEvent.click(screen.getByRole("button", { name: "Select a model" }));

		expect(screen.getByRole("option", { name: "Max automatic mode" })).toBeDisabled();
	});
});
