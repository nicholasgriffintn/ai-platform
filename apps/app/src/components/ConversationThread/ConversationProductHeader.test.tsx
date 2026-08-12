import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { Conversation } from "~/types";
import { ConversationProductHeader } from "./ConversationProductHeader";

const mocks = vi.hoisted(() => ({
	conversation: null as Conversation | null,
	isLoading: false,
}));

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({ trackEvent: vi.fn() }),
}));

vi.mock("~/hooks/useChat", () => ({
	useChat: () => ({ data: mocks.conversation, isLoading: mocks.isLoading }),
}));

describe("ConversationProductHeader", () => {
	beforeEach(() => {
		mocks.isLoading = false;
		mocks.conversation = {
			id: "conversation-1",
			title: "Plan the next release",
			messages: [{ id: "message-1", role: "user", content: "What should we ship?" }],
		};
		useChatStore.setState({
			currentConversationId: "conversation-1",
			isAuthenticated: true,
			isPro: true,
			localOnlyMode: false,
		});
		useUIStore.setState({ isMobile: false, sidebarVisible: true });
	});

	it("shows the current title and conversation actions in the product header", () => {
		render(
			<MemoryRouter initialEntries={["/chat"]}>
				<ConversationProductHeader />
			</MemoryRouter>,
		);

		expect(screen.getByTitle("Plan the next release")).toHaveTextContent("Plan the next release");
		expect(screen.getByRole("button", { name: "View conversation trace" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Share conversation" })).toBeInTheDocument();
	});

	it("keeps branch navigation available beside the conversation title", () => {
		mocks.conversation = {
			...mocks.conversation!,
			parent_conversation_id: "conversation-parent",
		};

		render(
			<MemoryRouter initialEntries={["/chat"]}>
				<ConversationProductHeader />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Go to original conversation" }));

		expect(useChatStore.getState().currentConversationId).toBe("conversation-parent");
	});

	it("shows a new-conversation title without unavailable actions", () => {
		mocks.conversation = null;
		useChatStore.setState({ currentConversationId: undefined });

		render(
			<MemoryRouter initialEntries={["/chat"]}>
				<ConversationProductHeader />
			</MemoryRouter>,
		);

		expect(screen.getByText("New conversation")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "View conversation trace" }),
		).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Share conversation" })).not.toBeInTheDocument();
	});

	it("does not offer public sharing for a project conversation", () => {
		mocks.conversation = {
			...mocks.conversation!,
			project_id: "project-1",
		};

		render(
			<MemoryRouter initialEntries={["/work/workspace-1/projects/project-1/chat"]}>
				<ConversationProductHeader />
			</MemoryRouter>,
		);

		expect(screen.queryByRole("button", { name: "Share conversation" })).not.toBeInTheDocument();
	});
});
