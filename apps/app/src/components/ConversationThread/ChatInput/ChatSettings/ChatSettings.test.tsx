import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatSettings as ChatSettingsType } from "~/types";
import { ChatSettings } from ".";

const store: {
	chatMode: "remote" | "local" | "tool" | "agent";
	chatSettings: ChatSettingsType;
	isAuthenticated: boolean;
	isPro: boolean;
	model: string | null;
	setChatSettings: ReturnType<typeof vi.fn>;
	setUseMultiModel: ReturnType<typeof vi.fn>;
	useMultiModel: boolean;
} = {
	chatMode: "remote",
	chatSettings: {
		temperature: 0.7,
		top_p: 0.8,
		max_tokens: 2048,
		presence_penalty: 0,
		frequency_penalty: 0,
		use_rag: false,
	},
	isAuthenticated: true,
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

vi.mock("./ToolSelector", () => ({
	ToolSelector: ({ isDisabled = false }: { isDisabled?: boolean }) => (
		<button type="button" disabled={isDisabled}>
			Manage AI tools
		</button>
	),
}));

describe("ChatSettings", () => {
	beforeEach(() => {
		store.chatMode = "remote";
		store.chatSettings = {
			temperature: 0.7,
			top_p: 0.8,
			max_tokens: 2048,
			presence_penalty: 0,
			frequency_penalty: 0,
			use_rag: false,
		};
		store.isAuthenticated = true;
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

	it("updates the automatic compaction setting", async () => {
		render(<ChatSettings />);

		fireEvent.click(screen.getByLabelText("Open chat settings"));
		fireEvent.mouseDown(await screen.findByRole("tab", { name: "Advanced" }), {
			button: 0,
			ctrlKey: false,
		});
		fireEvent.change(await screen.findByLabelText("Context compaction"), {
			target: { value: "off" },
		});

		await waitFor(() =>
			expect(store.setChatSettings).toHaveBeenCalledWith({
				...store.chatSettings,
				compaction: "off",
			}),
		);
	});

	it("keeps numeric-looking RAG namespaces as strings", async () => {
		store.chatSettings = {
			...store.chatSettings,
			use_rag: true,
			rag_options: {
				topK: 3,
				scoreThreshold: 0.5,
				includeMetadata: false,
			},
		};

		render(<ChatSettings />);

		fireEvent.click(screen.getByLabelText("Open chat settings"));
		fireEvent.mouseDown(await screen.findByRole("tab", { name: "Advanced" }), {
			button: 0,
			ctrlKey: false,
		});
		fireEvent.change(await screen.findByLabelText("Namespace"), {
			target: { value: "123" },
		});

		await waitFor(() =>
			expect(store.setChatSettings).toHaveBeenCalledWith({
				...store.chatSettings,
				rag_options: {
					...store.chatSettings.rag_options,
					namespace: "123",
				},
			}),
		);
	});

	it("shows tools for signed-in remote auto mode", () => {
		store.isPro = false;
		store.model = null;

		render(<ChatSettings supportsToolCalls={false} />);

		expect(screen.getByRole("button", { name: "Manage AI tools" })).toBeInTheDocument();
	});
});
