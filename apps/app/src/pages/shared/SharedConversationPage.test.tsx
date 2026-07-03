import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ArtifactProps } from "~/types/artifact";
import SharedConversationPage from "./[share_id]";

const mocks = vi.hoisted(() => ({
	fetchSharedConversationHistory: vi.fn(),
}));

vi.mock("react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
	useParams: () => ({ share_id: "shared-1" }),
}));

vi.mock("~/constants", () => ({
	API_BASE_URL: "https://api.test",
}));

vi.mock("~/lib/api/shared-conversation", () => ({
	fetchSharedConversationHistory: mocks.fetchSharedConversationHistory,
}));

vi.mock("~/components/Core/PageShell", () => ({
	PageShell: ({
		children,
		headerContent,
	}: {
		children: React.ReactNode;
		headerContent?: React.ReactNode;
	}) => (
		<div>
			{headerContent}
			{children}
		</div>
	),
}));

vi.mock("~/components/Core/PageStatus", () => ({
	PageStatus: ({ message, children }: { message: string; children?: React.ReactNode }) => (
		<div>
			{message}
			{children}
		</div>
	),
}));

vi.mock("~/components/LoadingSpinner", () => ({
	LoadingSpinner: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("~/components/ConversationThread/MessageList", () => ({
	MessageList: ({
		onArtifactOpen,
	}: {
		onArtifactOpen?: (
			artifact: ArtifactProps,
			combine?: boolean,
			artifacts?: ArtifactProps[],
		) => void;
	}) => {
		const appArtifact: ArtifactProps = {
			identifier: "app",
			type: "text/javascript",
			language: "javascript",
			title: "App",
			content: "console.log('app');",
		};
		const styleArtifact: ArtifactProps = {
			identifier: "styles",
			type: "text/css",
			language: "css",
			title: "Styles",
			content: "body { color: red; }",
		};
		const notesArtifact: ArtifactProps = {
			identifier: "notes",
			type: "text/plain",
			title: "Notes",
			content: "Notes",
		};

		return (
			<div>
				<button
					type="button"
					onClick={() => onArtifactOpen?.(appArtifact, true, [appArtifact, styleArtifact])}
				>
					Open combined
				</button>
				<button type="button" onClick={() => onArtifactOpen?.(notesArtifact, false)}>
					Open single
				</button>
			</div>
		);
	},
}));

vi.mock("~/components/ConversationThread/Artifacts/ArtifactPanel", () => ({
	ArtifactPanel: ({ isCombined }: { isCombined?: boolean }) => (
		<div data-testid="artifact-panel-mode">{isCombined ? "combined" : "single"}</div>
	),
}));

describe("SharedConversationPage artifacts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
			}),
		);
		mocks.fetchSharedConversationHistory.mockResolvedValue({
			messages: [{ id: "message-1", role: "assistant", content: "Shared message" }],
			share_id: "shared-1",
		});
	});

	it("clears combined artifact state when a single artifact is opened afterwards", async () => {
		render(<SharedConversationPage />);

		await waitFor(() => expect(screen.getByText("Open combined")).toBeInTheDocument());

		fireEvent.click(screen.getByText("Open combined"));
		expect(screen.getByTestId("artifact-panel-mode")).toHaveTextContent("combined");

		fireEvent.click(screen.getByText("Open single"));
		expect(screen.getByTestId("artifact-panel-mode")).toHaveTextContent("single");
	});
});
