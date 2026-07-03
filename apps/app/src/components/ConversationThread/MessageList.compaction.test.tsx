import { render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessageList } from "./MessageList";
import type { Message } from "~/types";

const mocks = vi.hoisted(() => ({
	currentConversationId: "conversation-1",
	isStreamLoading: false,
	loadingMessage: "",
}));

type MockVirtualListHandle = {
	scrollToIndex: (index: number) => void;
	scrollSize: number;
	scrollOffset: number;
	viewportSize: number;
};

vi.mock("virtua", () => ({
	VList: forwardRef<MockVirtualListHandle, { children: React.ReactNode }>(({ children }, ref) => {
		useImperativeHandle(ref, () => ({
			scrollToIndex: vi.fn(),
			scrollSize: 0,
			scrollOffset: 0,
			viewportSize: 0,
		}));

		return <div>{children}</div>;
	}),
}));

vi.mock("~/hooks/useChat", () => ({
	useChat: () => ({
		data: {
			id: "conversation-1",
			title: "Test conversation",
			messages: [],
		},
		isLoading: false,
	}),
}));

vi.mock("~/hooks/useChatManager", () => ({
	useChatManager: () => ({
		streamStarted: false,
		retryMessage: vi.fn(),
		updateUserMessage: vi.fn(),
		editingMessageId: null,
		startEditingMessage: vi.fn(),
		stopEditingMessage: vi.fn(),
	}),
}));

vi.mock("~/hooks/useCanAccessProFeatures", () => ({
	useCanAccessProFeatures: () => false,
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({ data: {} }),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: () => [],
}));

vi.mock("~/state/contexts/LoadingContext", () => ({
	useIsLoading: (key: string) => key === "stream-response" && mocks.isStreamLoading,
	useLoadingMessage: (key: string) => (key === "stream-response" ? mocks.loadingMessage : ""),
	useLoadingProgress: () => 0,
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => ({
		currentConversationId: mocks.currentConversationId,
		isAuthenticated: true,
		setCurrentConversationId: vi.fn(),
	}),
}));

vi.mock("./ShareButton", () => ({
	ShareButton: () => null,
}));

vi.mock("./AgentTracePanel", () => ({
	AgentTraceButton: () => null,
}));

describe("MessageList compaction status", () => {
	beforeEach(() => {
		mocks.isStreamLoading = false;
		mocks.loadingMessage = "";
	});

	it("shows an in-flight compaction divider while context is compacting", () => {
		mocks.isStreamLoading = true;
		mocks.loadingMessage = "Automatically compacting context";

		render(<MessageList messages={[]} />);

		expect(
			screen.getByRole("status", { name: "Automatically compacting context" }),
		).toBeInTheDocument();
	});

	it("shows the manual in-flight compaction divider", () => {
		mocks.isStreamLoading = true;
		mocks.loadingMessage = "Compacting context";

		render(<MessageList messages={[]} />);

		expect(screen.getByRole("status", { name: "Compacting context" })).toBeInTheDocument();
	});

	it("renders persisted compaction messages as completed divider rows", () => {
		const messages: Message[] = [
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context automatically compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
					},
				] satisfies Message["parts"],
			},
		];

		render(<MessageList messages={messages} />);

		expect(
			screen.getByRole("status", { name: "Context automatically compacted" }),
		).toBeInTheDocument();
	});

	it("does not duplicate the in-flight divider after the current response marker is inserted", () => {
		mocks.isStreamLoading = true;
		mocks.loadingMessage = "Automatically compacting context";
		const messages: Message[] = [
			{
				id: "user-1",
				role: "user",
				content: "Continue",
			},
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context automatically compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
					},
				] satisfies Message["parts"],
			},
			{
				id: "assistant-1",
				role: "assistant",
				content: "",
			},
		];

		render(<MessageList messages={messages} />);

		expect(
			screen.getByRole("status", { name: "Context automatically compacted" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("status", { name: "Automatically compacting context" }),
		).not.toBeInTheDocument();
	});

	it("renders compaction role messages with status parts as completed divider rows", () => {
		const messages: Message[] = [
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context compacted",
					},
				] satisfies Message["parts"],
			},
		];

		render(<MessageList messages={messages} />);

		expect(screen.getByRole("status", { name: "Context compacted" })).toBeInTheDocument();
	});
});
