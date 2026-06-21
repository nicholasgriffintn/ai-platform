import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationThread } from ".";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	toastError: vi.fn(),
	trackError: vi.fn(),
	trackEvent: vi.fn(),
	trackFeatureUsage: vi.fn(),
	sendMessage: vi.fn(),
	resolveAssistantActionSubmit: vi.fn(),
	setChatInput: vi.fn(),
	setSelectedAssistantAction: vi.fn(),
	chatStore: {
		currentConversationId: undefined as string | undefined,
		model: "deepseek",
		chatInput: "run @Daily Weather",
		selectedAssistantAction: {
			item: {
				id: "installed_recipe:daily-weather",
				kind: "installed_recipe" as const,
				label: "Daily Weather",
				metadata: {
					recipeId: "daily-weather",
				},
			},
			tokenPosition: 4,
		},
	},
}));

vi.mock("react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
	toast: {
		error: mocks.toastError,
	},
}));

vi.mock("~/components/ConversationThread/UsageLimitWarning", () => ({
	UsageLimitWarning: () => null,
}));

vi.mock("~/hooks/use-track-event", () => ({
	EventCategory: {
		CONVERSATION: "conversation",
	},
	useTrackEvent: () => ({
		trackError: mocks.trackError,
		trackEvent: mocks.trackEvent,
		trackFeatureUsage: mocks.trackFeatureUsage,
	}),
}));

vi.mock("~/hooks/useChat", () => ({
	useChat: () => ({ data: { messages: [] } }),
}));

vi.mock("~/hooks/useChatManager", () => ({
	useChatManager: () => ({
		streamStarted: false,
		controller: new AbortController(),
		sendMessage: mocks.sendMessage,
		sendCouncilDebate: vi.fn(),
		abortStream: vi.fn(),
		branchConversation: vi.fn(),
		isBranching: false,
		requestOpinion: vi.fn(),
		isRequestingOpinion: false,
	}),
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({ data: {} }),
}));

vi.mock("~/state/contexts/LoadingContext", () => ({
	useIsLoading: () => false,
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => ({
		...mocks.chatStore,
		setChatInput: mocks.setChatInput,
		setSelectedAssistantAction: mocks.setSelectedAssistantAction,
	}),
}));

vi.mock("./useAssistantActionSubmit", () => ({
	useAssistantActionSubmit: () => ({
		resolveAssistantActionSubmit: mocks.resolveAssistantActionSubmit,
	}),
}));

vi.mock("./useAutoPlayResponses", () => ({
	useAutoPlayResponses: () => ({
		isGeneratingSpeech: false,
		isPlaying: false,
		stopPlayback: vi.fn(),
	}),
}));

vi.mock("./ChatInput", () => ({
	ChatInput: ({ handleSubmit }: { handleSubmit: () => Promise<void> }) => (
		<button type="button" onClick={() => void handleSubmit()}>
			Send
		</button>
	),
}));

vi.mock("./FooterInfo", () => ({
	FooterInfo: () => null,
}));

vi.mock("./MessageList", () => ({
	MessageList: () => null,
}));

vi.mock("./WelcomeScreen", () => ({
	WelcomeScreen: () => null,
}));

vi.mock("./Artifacts/ArtifactPanel", () => ({
	ArtifactPanel: () => null,
}));

describe("ConversationThread assistant action submit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.chatStore.chatInput = "run @Daily Weather";
		mocks.chatStore.selectedAssistantAction = {
			item: {
				id: "installed_recipe:daily-weather",
				kind: "installed_recipe",
				label: "Daily Weather",
				metadata: {
					recipeId: "daily-weather",
				},
			},
			tokenPosition: 4,
		};
	});

	it("keeps the composer state in place when recipe action resolution fails", async () => {
		mocks.resolveAssistantActionSubmit.mockRejectedValue(new Error("Recipe install failed"));

		render(<ConversationThread />);

		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Recipe install failed"));
		expect(mocks.setChatInput).not.toHaveBeenCalledWith("");
		expect(mocks.setSelectedAssistantAction).not.toHaveBeenCalledWith(null);
		expect(mocks.sendMessage).not.toHaveBeenCalled();
	});

	it("shows returned API errors when chat submission fails", async () => {
		mocks.resolveAssistantActionSubmit.mockResolvedValue({
			kind: "submit",
			input: "run @Daily Weather",
			requestOptions: {
				recipe: {
					id: "daily-weather",
				},
			},
		});
		mocks.sendMessage.mockResolvedValue({
			status: "error",
			response: "Recipe tool failed",
		});

		render(<ConversationThread />);

		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Recipe tool failed"));
		expect(mocks.setChatInput).toHaveBeenCalledWith("");
		expect(mocks.setSelectedAssistantAction).toHaveBeenCalledWith(null);
		expect(mocks.setChatInput).toHaveBeenCalledWith("run @Daily Weather");
		expect(mocks.setSelectedAssistantAction).toHaveBeenCalledWith(
			mocks.chatStore.selectedAssistantAction,
		);
	});
});
