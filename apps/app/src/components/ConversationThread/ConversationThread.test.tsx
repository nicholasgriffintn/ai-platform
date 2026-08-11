import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssistantActionSelection } from "@assistant/schemas";
import type { AttachmentData } from "~/lib/chat/attachments";
import { ConversationThread } from ".";

const mocks = vi.hoisted(() => {
	const chatStore: {
		currentConversationId: string | undefined;
		model: string;
		chatInput: string;
		selectedAssistantAction: AssistantActionSelection | null;
	} = {
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
	};
	const submitAttachments: { current: AttachmentData[] | undefined } = {
		current: undefined,
	};

	return {
		navigate: vi.fn(),
		toastError: vi.fn(),
		trackError: vi.fn(),
		trackEvent: vi.fn(),
		trackFeatureUsage: vi.fn(),
		compactConversation: vi.fn(),
		sendMessage: vi.fn(),
		resolveAssistantActionSubmit: vi.fn(),
		useAssistantActionSubmitOptions: vi.fn(),
		setChatInput: vi.fn(),
		setSelectedAssistantAction: vi.fn(),
		chatStore,
		submitAttachments,
	};
});

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
		compactConversation: mocks.compactConversation,
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
	useAssistantActionSubmit: (options: unknown) => {
		mocks.useAssistantActionSubmitOptions(options);
		return {
			resolveAssistantActionSubmit: mocks.resolveAssistantActionSubmit,
		};
	},
}));

vi.mock("./useAutoPlayResponses", () => ({
	useAutoPlayResponses: () => ({
		isGeneratingSpeech: false,
		isPlaying: false,
		stopPlayback: vi.fn(),
	}),
}));

vi.mock("./ChatInput", () => ({
	ChatInput: ({
		attachmentProjectId,
		contextAttachments,
		handleSubmit,
		onRemoveContextAttachment,
	}: {
		attachmentProjectId?: string;
		contextAttachments?: AttachmentData[];
		handleSubmit: (attachments?: AttachmentData[]) => void | Promise<unknown>;
		onRemoveContextAttachment?: (index: number) => void;
	}) => (
		<>
			<button
				type="button"
				data-attachment-project-id={attachmentProjectId}
				data-context-attachment-count={contextAttachments?.length ?? 0}
				onClick={() => void handleSubmit(mocks.submitAttachments.current)}
			>
				Send
			</button>
			{contextAttachments?.length ? (
				<button type="button" onClick={() => onRemoveContextAttachment?.(0)}>
					Remove first context attachment
				</button>
			) : null}
		</>
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
		mocks.chatStore.currentConversationId = undefined;
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
		mocks.submitAttachments.current = undefined;
	});

	it("passes project recipe management routes to assistant actions", () => {
		render(
			<ConversationThread
				modeConfig={{
					assistantActionRoutes: {
						recipes: "/work/workspace-1/projects/project-1/library",
					},
				}}
			/>,
		);

		expect(mocks.useAssistantActionSubmitOptions).toHaveBeenCalledWith({
			recipeManagementPath: "/work/workspace-1/projects/project-1/library",
		});
	});

	it("compacts the current conversation without sending a chat message", async () => {
		mocks.chatStore.chatInput = "/compact";
		mocks.chatStore.currentConversationId = "conversation-1";
		mocks.chatStore.selectedAssistantAction = null;
		mocks.compactConversation.mockResolvedValue({
			status: "success",
			response: "",
			compacted: true,
		});

		render(<ConversationThread />);

		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => expect(mocks.compactConversation).toHaveBeenCalledTimes(1));
		expect(mocks.resolveAssistantActionSubmit).not.toHaveBeenCalled();
		expect(mocks.sendMessage).not.toHaveBeenCalled();
		expect(mocks.setChatInput).toHaveBeenCalledWith("");
		expect(mocks.setSelectedAssistantAction).toHaveBeenCalledWith(null);
	});

	it("treats /compact as a command even when attachments are present", async () => {
		mocks.chatStore.chatInput = "/compact";
		mocks.chatStore.currentConversationId = "conversation-1";
		mocks.chatStore.selectedAssistantAction = null;
		mocks.submitAttachments.current = [{ type: "document", data: "notes", name: "notes.txt" }];
		mocks.compactConversation.mockResolvedValue({
			status: "success",
			response: "",
			compacted: true,
		});

		render(<ConversationThread />);

		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => expect(mocks.compactConversation).toHaveBeenCalledTimes(1));
		expect(mocks.resolveAssistantActionSubmit).not.toHaveBeenCalled();
		expect(mocks.sendMessage).not.toHaveBeenCalled();
		expect(mocks.setChatInput).toHaveBeenCalledWith("");
		expect(mocks.setSelectedAssistantAction).toHaveBeenCalledWith(null);
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

	it("retains the Work project scope when a recipe adds request options", async () => {
		mocks.resolveAssistantActionSubmit.mockResolvedValue({
			kind: "submit",
			input: "run @Daily Weather",
			requestOptions: { options: { recipe: { id: "daily-weather" } } },
		});
		mocks.sendMessage.mockResolvedValue({ status: "success", response: "Done" });

		render(
			<ConversationThread
				modeConfig={{
					requestOptions: { metadata: { project_id: "project-1" } },
				}}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() =>
			expect(mocks.sendMessage).toHaveBeenCalledWith("run @Daily Weather", undefined, {
				metadata: { project_id: "project-1" },
				options: { recipe: { id: "daily-weather" } },
			}),
		);
	});

	it("uses the Work request scope for attachment uploads", () => {
		render(
			<ConversationThread
				modeConfig={{
					requestOptions: { metadata: { project_id: "project-1" } },
				}}
			/>,
		);

		expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
			"data-attachment-project-id",
			"project-1",
		);
	});

	it("passes mode context attachments through the shared composer", () => {
		const onRemoveContextAttachment = vi.fn();
		render(
			<ConversationThread
				modeConfig={{
					contextAttachments: [
						{
							type: "markdown_document",
							data: "source:launch-brief",
							name: "Launch brief",
							markdown: "Launch in October.",
						},
					],
					onRemoveContextAttachment,
				}}
			/>,
		);

		expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
			"data-context-attachment-count",
			"1",
		);
		fireEvent.click(screen.getByRole("button", { name: "Remove first context attachment" }));
		expect(onRemoveContextAttachment).toHaveBeenCalledWith(0);
	});

	it("passes mode request options to an initial auto-submit", async () => {
		mocks.chatStore.chatInput = "";
		mocks.chatStore.selectedAssistantAction = null;
		mocks.sendMessage.mockResolvedValue({ status: "success", response: "Done" });

		render(
			<ConversationThread
				modeConfig={{
					initialAutoSubmit: {
						key: "project-recipe:daily-weather",
						input: "Run the recipe",
					},
					requestOptions: { metadata: { project_id: "project-1" } },
				}}
			/>,
		);

		await waitFor(() =>
			expect(mocks.sendMessage).toHaveBeenCalledWith("Run the recipe", undefined, {
				metadata: { project_id: "project-1" },
			}),
		);
	});
});
