import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatInput } from ".";

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
	useModels: () => ({ data: {} }),
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

vi.mock("./ComposerCommandSurface", () => ({
	ComposerCommandButton: () => <button type="button">Commands</button>,
	ComposerCommandChips: () => null,
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

describe("ChatInput", () => {
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
});
