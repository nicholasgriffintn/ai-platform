import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AssistantActionSelection } from "@assistant/schemas";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
				modalities: {
					input: ["text", "image"],
					output: ["text"],
				},
			},
		},
	}),
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
	ComposerActionMenu: ({ tools }: { tools?: ReactNode }) => (
		<div>
			<button type="button">Actions</button>
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

describe("ChatInput", () => {
	beforeEach(() => {
		mocks.uploadComposerAttachment.mockReset();
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
