import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSettings } from ".";

const store = {
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
	setChatSettings: vi.fn(),
	setUseMultiModel: vi.fn(),
	useMultiModel: false,
};

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({
		data: {},
	}),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: () => ({}),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => store,
}));

describe("ChatSettings", () => {
	beforeEach(() => {
		store.chatMode = "remote";
		store.isPro = true;
		store.model = null;
		store.useMultiModel = false;
		store.setUseMultiModel.mockReset();
		store.setChatSettings.mockReset();
	});

	it("shows multi-model in settings for pro remote chat without a selected model", async () => {
		render(<ChatSettings />);

		fireEvent.click(screen.getByLabelText("Open chat settings"));

		const multiModelToggle = await screen.findByLabelText("Multi-model");
		expect(multiModelToggle).not.toBeChecked();

		fireEvent.click(multiModelToggle);

		await waitFor(() => expect(store.setUseMultiModel).toHaveBeenCalledWith(true));
	});
});
