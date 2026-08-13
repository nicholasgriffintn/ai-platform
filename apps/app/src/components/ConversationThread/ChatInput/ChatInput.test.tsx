import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AssistantActionSelection } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import { ChatInput } from ".";

const mocks = vi.hoisted(() => ({
	commandState: {
		chatInput: "",
		directive: null,
		modeCommands: [],
		selectedAgent: undefined as { id: string; name: string } | undefined,
		setChatInput: vi.fn(),
	},
	uploadComposerAttachment: vi.fn(),
	useComposerSources: vi.fn(),
	composerSources: {
		attachments: [] as AttachmentData[],
		attachingSourceId: null,
		attachSource: vi.fn(),
		availableSources: [
			{
				id: "source-1",
				title: "Launch brief",
				status: "available",
				kind: "text",
			},
		],
		clearAttachments: vi.fn(),
		isLoading: false,
		removeAttachment: vi.fn(),
	},
}));

const store = {
	chatInput: "",
	chatMode: "remote",
	currentConversationId: undefined,
	isAuthenticationLoading: false,
	isPro: false,
	model: "gpt-realtime-2" as string | null,
	selectedAgentId: null as string | null,
	selectedAgentTokenPosition: null as number | null,
	selectedAssistantAction: null as AssistantActionSelection | null,
	setChatInput: vi.fn(),
	setSelectedAgentTokenPosition: vi.fn(),
	setSelectedAssistantAction: vi.fn(),
	setUseMultiModel: vi.fn(),
	useMultiModel: false,
};

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({
		data: {
			"gpt-realtime-2": {
				id: "gpt-realtime-2",
				matchingModel: "gpt-realtime-2",
				name: "GPT Realtime 2",
				provider: "openai",
				multimodal: true,
				supportsAudio: true,
				supportsDocuments: true,
				modalities: {
					input: ["text", "image"],
					output: ["text"],
				},
			},
		},
	}),
}));

vi.mock("~/hooks/useModelTools", () => ({
	useModelToolOptions: () => [],
}));

vi.mock("~/hooks/useVoiceRecorder", () => ({
	useVoiceRecorder: () => ({
		isRecording: false,
		isTranscribing: false,
		startRecording: vi.fn(),
		stopRecording: vi.fn(),
	}),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => store,
}));

vi.mock("~/state/stores/toolsStore", () => ({
	useToolsStore: () => ({
		selectedTools: [],
		setSelectedTools: vi.fn(),
	}),
}));

vi.mock("~/state/stores/uiStore", () => ({
	useUIStore: () => ({ isMobile: false }),
}));

vi.mock("./ChatSettings", () => ({
	ChatSettings: () => <button type="button">Chat settings</button>,
}));

vi.mock("./ComposerActionMenu", () => ({
	ComposerActionMenu: ({
		onAttachSource,
		sourceScopeLabel,
		tools,
		uploadIcon,
	}: {
		onAttachSource?: (sourceId: string) => void;
		sourceScopeLabel?: string;
		tools?: ReactNode;
		uploadIcon?: ReactNode;
	}) => (
		<div>
			<button type="button">Actions</button>
			<button type="button" onClick={() => onAttachSource?.("source-1")}>
				Attach source
			</button>
			<span>{sourceScopeLabel}</span>
			<span data-testid="upload-action-icon">{uploadIcon}</span>
			{tools}
		</div>
	),
}));

interface MockAttachmentChip {
	label: string;
	onClear: () => void;
	preview: ReactNode;
}

vi.mock("./ComposerCommandSurface", () => ({
	ComposerCommandButton: () => <button type="button">Commands</button>,
	ComposerCommandChips: ({
		attachments = [],
		hideAgentChip,
		selectedAgent,
	}: {
		attachments?: MockAttachmentChip[];
		hideAgentChip?: boolean;
		selectedAgent?: { name: string };
	}) => (
		<div>
			{selectedAgent && !hideAgentChip && <span>{selectedAgent.name}</span>}
			{attachments.map((attachment) => (
				<div key={attachment.label}>
					{attachment.preview}
					<span>{attachment.label}</span>
					<button type="button" onClick={attachment.onClear}>
						Clear {attachment.label}
					</button>
				</div>
			))}
		</div>
	),
	ComposerCommandSuggestions: () => null,
}));

vi.mock("./InlineResponseControls", () => ({
	InlineResponseControls: () => <div>Inline response controls</div>,
}));

vi.mock("./ModelSelector", () => ({
	ModelSelector: () => <button type="button">Model selector</button>,
}));

vi.mock("./useComposerCommandController", () => ({
	useComposerCommandController: () => ({
		applyDirectiveSelection: vi.fn(),
		commandState: mocks.commandState,
		directiveQuery: null,
		moveActiveSuggestion: vi.fn(),
		setTextareaCursorPosition: vi.fn(),
	}),
}));

vi.mock("./uploadAttachment", () => ({
	uploadComposerAttachment: mocks.uploadComposerAttachment,
}));

vi.mock("./useComposerSources", () => ({
	useComposerSources: (options: unknown) => {
		mocks.useComposerSources(options);
		return mocks.composerSources;
	},
}));

describe("ChatInput", () => {
	beforeEach(() => {
		mocks.uploadComposerAttachment.mockReset();
		mocks.useComposerSources.mockReset();
		mocks.composerSources.attachSource.mockReset();
		mocks.composerSources.clearAttachments.mockReset();
		mocks.composerSources.removeAttachment.mockReset();
		mocks.composerSources.attachments = [];
		store.chatInput = "";
		store.currentConversationId = undefined;
		store.isAuthenticationLoading = false;
		store.isPro = false;
		store.model = "gpt-realtime-2";
		store.selectedAgentId = null;
		store.selectedAgentTokenPosition = null;
		store.selectedAssistantAction = null;
		store.setUseMultiModel.mockReset();
		store.useMultiModel = false;
		mocks.commandState.selectedAgent = undefined;
	});

	it("hides only the message textarea when requested", () => {
		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
				hideTextInput={true}
			/>,
		);

		expect(screen.queryByLabelText("Message input")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Commands" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Model selector" })).toBeInTheDocument();
		expect(screen.getByText("Inline response controls")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Chat settings" })).toBeInTheDocument();
	});

	it("shows the multi-model toggle in the composer action menu when auto model routing is active", () => {
		store.isPro = true;
		store.model = null;

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);

		const toggle = screen.getByRole("button", { name: "Multi-model" });

		fireEvent.click(toggle);

		expect(store.setUseMultiModel).toHaveBeenCalledWith(true);
	});

	it("uses one familiar icon for the attach-file action", () => {
		store.isPro = true;

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);

		const icon = screen.getByTestId("upload-action-icon");
		expect(icon.querySelectorAll("svg")).toHaveLength(1);
		expect(icon.querySelector("svg")).toHaveClass("lucide-paperclip");
	});

	it("uses the shared source action with personal or project scope", () => {
		store.isPro = true;
		const { rerender } = render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);

		expect(screen.getByText("Personal sources")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Attach source" }));
		expect(mocks.composerSources.attachSource).toHaveBeenCalledWith("source-1");

		rerender(
			<ChatInput
				attachmentProjectId="project-1"
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);
		expect(screen.getByText("Project sources")).toBeInTheDocument();
	});

	it("submits and clears an attached source with the message", () => {
		const handleSubmit = vi.fn();
		store.chatInput = "Use this brief";
		mocks.composerSources.attachments = [
			{
				type: "markdown_document",
				data: "https://api.test/sources/source-1/content",
				name: "Launch brief",
				markdown: "# Launch brief\n\nLaunch in October.",
			},
		];

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={handleSubmit}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Send message" }));

		expect(handleSubmit).toHaveBeenCalledWith(mocks.composerSources.attachments);
		expect(mocks.composerSources.clearAttachments).toHaveBeenCalledOnce();
	});

	it("uses the hidden textarea space for mode controls", () => {
		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
				hideTextInput={true}
				controls={<div>Live session controls</div>}
			/>,
		);

		expect(screen.queryByLabelText("Message input")).not.toBeInTheDocument();
		expect(screen.getByText("Live session controls")).toBeInTheDocument();
	});

	it("lets mode controls own the composer when default controls are hidden", () => {
		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
				hideDefaultControls={true}
				hideTextInput={true}
				controls={<div>Live audio interface</div>}
			/>,
		);

		expect(screen.getByText("Live audio interface")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Commands" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Model selector" })).not.toBeInTheDocument();
	});

	it("can hide send-only live affordances while keeping model and mode selectors", () => {
		const originalIsPro = store.isPro;
		store.isPro = true;

		try {
			render(
				<ChatInput
					controller={new AbortController()}
					handleSubmit={vi.fn()}
					isLoading={false}
					onTranscribe={vi.fn()}
					streamStarted={false}
					hideComposerActionMenu={true}
					hideInlineResponseControls={true}
					hideSubmitButton={true}
					hideTextInput={true}
					controls={<div>Live audio interface</div>}
				/>,
			);
		} finally {
			store.isPro = originalIsPro;
		}

		expect(screen.getByText("Live audio interface")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Commands" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Model selector" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Actions" })).not.toBeInTheDocument();
		expect(screen.queryByText("Inline response controls")).not.toBeInTheDocument();
	});

	it("keeps the command control mounted when live controls replace the text input", () => {
		const { rerender } = render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);
		const commandButton = screen.getByRole("button", { name: "Commands" });

		rerender(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
				hideComposerActionMenu={true}
				hideInlineResponseControls={true}
				hideSubmitButton={true}
				hideTextInput={true}
				controls={<div>Live audio interface</div>}
			/>,
		);

		expect(screen.getByRole("button", { name: "Commands" })).toBe(commandButton);
	});

	it("keeps a hydrated selected agent visible when no inline token exists", () => {
		store.selectedAgentId = "agent-1";
		store.selectedAgentTokenPosition = null;
		mocks.commandState.selectedAgent = { id: "agent-1", name: "Reviewer" };

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);

		expect(screen.getByText("Reviewer")).toBeInTheDocument();
	});

	it("hides the selected agent chip when an inline token renders it", () => {
		store.selectedAgentId = "agent-1";
		store.selectedAgentTokenPosition = 0;
		mocks.commandState.selectedAgent = { id: "agent-1", name: "Reviewer" };

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);

		expect(screen.queryByText("Reviewer")).not.toBeInTheDocument();
	});

	it("loads selected private image attachment previews with credentials", async () => {
		const privateAssetUrl = "http://localhost:8787/assets/private-image-id";
		mocks.uploadComposerAttachment.mockResolvedValue({
			attachment: {
				type: "image",
				data: privateAssetUrl,
				mimeType: "image/png",
			},
		});

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Upload a file (images, documents, audio, and code)"), {
			target: {
				files: [new File(["image"], "selected.png", { type: "image/png" })],
			},
		});

		await waitFor(() => expect(screen.getByText("Image attached")).toBeInTheDocument());

		expect(screen.getByAltText("Selected")).toHaveAttribute("src", privateAssetUrl);
		expect(screen.getByAltText("Selected")).toHaveAttribute("crossorigin", "use-credentials");
	});

	it("passes the project scope into attachment uploads", async () => {
		mocks.uploadComposerAttachment.mockResolvedValue({
			attachment: {
				type: "image",
				data: "https://files.test/selected.png",
			},
		});

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={vi.fn()}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
				attachmentProjectId="project-1"
			/>,
		);

		const file = new File(["image"], "selected.png", { type: "image/png" });
		fireEvent.change(screen.getByLabelText("Upload a file (images, documents, audio, and code)"), {
			target: { files: [file] },
		});

		await waitFor(() =>
			expect(mocks.uploadComposerAttachment).toHaveBeenCalledWith(
				file,
				expect.objectContaining({ projectId: "project-1" }),
			),
		);
	});

	it("shows artifact selection context as an attachment chip and submits it with the prompt", () => {
		const handleSubmit = vi.fn();
		const handleRemoveContextAttachment = vi.fn();
		const handleClearContextAttachments = vi.fn();
		store.chatInput = "Make this firmer";

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={handleSubmit}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
				contextAttachments={[
					{
						type: "artifact_selection",
						name: "selection from Launch plan",
						artifact: {
							identifier: "launch-plan",
							type: "text/markdown",
							title: "Launch plan",
						},
						selectedText: "This paragraph needs work.",
						selectionStart: 12,
						selectionEnd: 38,
					},
				]}
				onRemoveContextAttachment={handleRemoveContextAttachment}
				onClearContextAttachments={handleClearContextAttachments}
			/>,
		);

		expect(screen.getByText("selection from Launch plan")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Send message" }));

		expect(handleSubmit).toHaveBeenCalledWith([
			expect.objectContaining({
				type: "artifact_selection",
				selectedText: "This paragraph needs work.",
			}),
		]);
		expect(handleClearContextAttachments).toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Clear selection from Launch plan" }));
		expect(handleRemoveContextAttachment).toHaveBeenCalledWith(0);
	});

	it("retains artifact context when the asynchronous send fails", async () => {
		const handleSubmit = vi.fn().mockResolvedValue(false);
		const handleClearContextAttachments = vi.fn();
		store.chatInput = "Make this firmer";

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={handleSubmit}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
				contextAttachments={[
					{
						type: "artifact_selection",
						name: "selection from Launch plan",
						artifact: {
							identifier: "launch-plan",
							type: "text/markdown",
							title: "Launch plan",
						},
						selectedText: "This paragraph needs work.",
						selectionStart: 12,
						selectionEnd: 38,
					},
				]}
				onClearContextAttachments={handleClearContextAttachments}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Send message" }));

		await waitFor(() => expect(handleSubmit).toHaveBeenCalledOnce());
		expect(handleClearContextAttachments).not.toHaveBeenCalled();
		expect(screen.getByText("selection from Launch plan")).toBeInTheDocument();
	});

	it("does not submit while user configuration is still loading", () => {
		const handleSubmit = vi.fn();
		store.chatInput = "Do this later";
		store.isAuthenticationLoading = true;

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={handleSubmit}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
			/>,
		);

		expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

		fireEvent.keyDown(screen.getByLabelText("Message input"), {
			key: "Enter",
			shiftKey: false,
		});

		expect(handleSubmit).not.toHaveBeenCalled();
	});
});
