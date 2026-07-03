import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { ChatInput } from ".";

vi.mock("~/hooks/useAgentToolDefaults", () => ({
	useAgentToolDefaults: () => undefined,
}));

vi.mock("~/hooks/useAgents", () => ({
	useAgents: () => ({
		chatAgents: [],
		isLoadingAgents: false,
	}),
}));

vi.mock("~/hooks/useAssistantActionCatalog", () => ({
	useAssistantActionCatalog: () => ({
		verbs: [],
		items: [],
	}),
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({
		data: {
			"deepseek-v4-pro": {
				id: "deepseek-v4-pro",
				matchingModel: "deepseek-v4-pro",
				name: "DeepSeek V4 Pro",
				provider: "deepseek",
				supportsToolCalls: false,
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

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: () => ({}),
}));

vi.mock("~/state/stores/toolsStore", () => ({
	useToolsStore: (
		selector: (state: { selectedTools: string[]; setSelectedTools: () => void }) => unknown,
	) =>
		selector({
			selectedTools: [],
			setSelectedTools: vi.fn(),
		}),
}));

vi.mock("~/state/stores/uiStore", () => ({
	useUIStore: () => ({ isMobile: false }),
}));

function setTextSelection(element: HTMLElement, offset: number) {
	const textNode = element.firstChild;
	if (!textNode) {
		throw new Error("Expected editable text content");
	}

	const range = document.createRange();
	range.setStart(textNode, offset);
	range.collapse(true);

	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

describe("ChatInput command submission", () => {
	beforeEach(() => {
		useChatStore.setState({
			chatInput: "/compact",
			chatMode: "remote",
			currentConversationId: "conversation-1",
			isAuthenticationLoading: false,
			isPro: true,
			model: "deepseek-v4-pro",
			selectedAgentId: null,
			selectedAgentTokenPosition: null,
			selectedAssistantAction: null,
		});
	});

	it("submits /compact on Enter even when cursor state still points at a partial command", () => {
		const handleSubmit = vi.fn();

		render(
			<ChatInput
				controller={new AbortController()}
				handleSubmit={handleSubmit}
				isLoading={false}
				onTranscribe={vi.fn()}
				streamStarted={false}
				hideDefaultControls={true}
			/>,
		);

		const input = screen.getByRole("textbox", { name: "Message input" });
		setTextSelection(input, 4);
		fireEvent.keyUp(input);
		fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

		expect(handleSubmit).toHaveBeenCalledTimes(1);
	});
});
