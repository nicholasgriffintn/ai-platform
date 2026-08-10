import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { HomePage } from "./HomePage";

const mocks = vi.hoisted(() => ({
	canvas: { mode: "image" },
	clearCurrentConversation: vi.fn(),
	initializeStore: vi.fn().mockResolvedValue(undefined),
	setShowSearch: vi.fn(),
}));

vi.mock("~/components/Canvas/CanvasGenerationsView", () => ({
	CanvasGenerationsView: () => <div>Canvas generations</div>,
}));
vi.mock("~/components/Canvas/useCanvasStudio", () => ({
	useCanvasStudio: () => mocks.canvas,
}));
vi.mock("~/components/ChatSidebar", () => ({
	ChatSidebar: ({
		canvas,
		isCanvasMode,
		onCanvasModeChange,
	}: {
		canvas?: unknown;
		isCanvasMode?: boolean;
		onCanvasModeChange?: (value: boolean) => void;
	}) =>
		canvas && onCanvasModeChange ? (
			<button type="button" onClick={() => onCanvasModeChange(!isCanvasMode)}>
				{isCanvasMode ? "Switch to chat" : "Switch to image generation"}
			</button>
		) : null,
}));
vi.mock("~/components/Core/PageShell", () => ({
	PageShell: ({ children, sidebarContent }: { children: ReactNode; sidebarContent: ReactNode }) => (
		<div>
			<aside>{sidebarContent}</aside>
			{children}
		</div>
	),
}));
vi.mock("~/components/Core/ProductModeHeader", () => ({ ProductModeHeader: () => null }));
vi.mock("~/components/Search/SearchDialog", () => ({ SearchDialog: () => null }));
vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => ({
		clearCurrentConversation: mocks.clearCurrentConversation,
		initializeStore: mocks.initializeStore,
		setShowSearch: mocks.setShowSearch,
		showSearch: false,
	}),
}));
vi.mock("./HomeConversationThread", () => ({
	HomeConversationThread: () => <div>Conversation</div>,
}));

describe("HomePage", () => {
	it("provides the canvas mode control and switches the chat content", () => {
		render(
			<MemoryRouter>
				<HomePage />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Switch to image generation" }));

		expect(screen.getByRole("button", { name: "Switch to chat" })).toBeInTheDocument();
		expect(screen.getByText("Canvas generations")).toBeInTheDocument();
		expect(screen.queryByText("Conversation")).not.toBeInTheDocument();
	});
});
