import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatInput } from ".";

const mocks = vi.hoisted(() => ({
	uploadComposerAttachment: vi.fn(),
}));

const store = {
	chatInput: "",
	chatMode: "remote",
	currentConversationId: undefined,
	isPro: false,
	model: "gpt-realtime-2",
	selectedAgentId: null,
	setChatInput: vi.fn(),
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

vi.mock("~/state/stores/uiStore", () => ({
	useUIStore: () => ({ isMobile: false }),
}));

vi.mock("./ChatSettings", () => ({
	ChatSettings: () => <button type="button">Chat settings</button>,
}));

vi.mock("./ComposerActionMenu", () => ({
	ComposerActionMenu: () => <button type="button">Actions</button>,
}));

interface MockAttachmentChip {
	label: string;
	onClear: () => void;
	preview: ReactNode;
}

vi.mock("./ComposerCommandSurface", () => ({
	ComposerCommandButton: () => <button type="button">Commands</button>,
	ComposerCommandChips: ({ attachments = [] }: { attachments?: MockAttachmentChip[] }) => (
		<div>
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
		commandState: {
			chatInput: "",
			directive: null,
			modeCommands: [],
			setChatInput: vi.fn(),
		},
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
		store.isPro = false;
		store.model = "gpt-realtime-2";
		store.selectedAgentId = null;
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
});
