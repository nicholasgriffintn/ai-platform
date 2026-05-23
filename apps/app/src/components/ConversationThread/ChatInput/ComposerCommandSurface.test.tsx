import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	ComposerCommandButton,
	ComposerCommandChips,
	ComposerCommandSuggestions,
} from "./ComposerCommandSurface";
import type { ComposerCommandAction } from "./composerCommandTypes";

const mocks = vi.hoisted(() => ({
	store: {
		chatMode: "remote",
		chatSettings: {},
		isPro: true,
		model: null as string | null,
		selectedAgentId: null as string | null,
		setChatMode: vi.fn(),
		setChatSettings: vi.fn(),
		setModel: vi.fn(),
		setSelectedAgentId: vi.fn(),
		setUseMultiModel: vi.fn(),
		useMultiModel: false,
	},
}));

vi.mock("~/hooks/useAgents", () => ({
	useAgents: () => ({
		chatAgents: [
			{
				id: "agent-1",
				name: "Reviewer",
				description: "Reviews risky changes",
				model: "model-1",
			},
		],
		isLoadingAgents: false,
	}),
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({ data: {} }),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: () => ({}),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => mocks.store,
}));

function createModeCommand(overrides: Partial<ComposerCommandAction> = {}): ComposerCommandAction {
	return {
		id: "sandbox",
		label: "Sandbox",
		description: "Run repository tasks",
		command: "sandbox",
		icon: <span aria-hidden="true">S</span>,
		isActive: false,
		onSelect: vi.fn(),
		...overrides,
	};
}

describe("ComposerCommandSurface", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.store.selectedAgentId = null;
	});

	it("selects modes from the compact command button", () => {
		const command = createModeCommand();

		render(
			<ComposerCommandButton
				chatInput=""
				directive={null}
				modeCommands={[command]}
				setChatInput={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open commands" }));
		fireEvent.click(screen.getByRole("button", { name: /Sandbox/i }));

		expect(command.onSelect).toHaveBeenCalledTimes(1);
	});

	it("keeps command button options in one scrollable list with shared highlights", () => {
		render(
			<ComposerCommandButton
				chatInput=""
				directive={null}
				modeCommands={[createModeCommand()]}
				setChatInput={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open commands" }));

		const popoverContent = document.querySelector('[data-slot="popover-content"]');
		const sandboxCommand = screen.getByRole("button", { name: /Sandbox/i });

		expect(popoverContent).not.toBeNull();
		expect(popoverContent?.querySelectorAll(".overflow-y-auto")).toHaveLength(1);
		expect(sandboxCommand).toHaveClass("hover:bg-blue-50");
	});

	it("shows attachment, mode, and agent chips with distinct styles", () => {
		mocks.store.selectedAgentId = "agent-1";

		render(
			<ComposerCommandChips
				chatInput=""
				directive={null}
				modeCommands={[
					createModeCommand({
						isActive: true,
					}),
				]}
				attachment={{
					label: "README.md (converted to text)",
					onClear: vi.fn(),
					preview: <span aria-hidden="true">F</span>,
				}}
				setChatInput={vi.fn()}
			/>,
		);

		expect(screen.getByText("README.md (converted to text)")).toBeInTheDocument();
		expect(screen.getByText("Sandbox")).toBeInTheDocument();
		expect(screen.getByText("Reviewer")).toBeInTheDocument();
		expect(document.querySelector('[data-composer-context-chip="attachment"]')).toHaveClass(
			"bg-amber-50",
		);
		expect(document.querySelector('[data-composer-context-chip="mode"]')).toHaveClass(
			"bg-emerald-50",
		);
		expect(document.querySelector('[data-composer-context-chip="agent"]')).toHaveClass(
			"bg-blue-50",
		);
	});

	it("selects an agent and strips the typed mention directive", () => {
		const setChatInput = vi.fn();

		render(
			<ComposerCommandSuggestions
				chatInput="@rev review this"
				directive={{ trigger: "@", query: "rev", start: 0, end: 4 }}
				modeCommands={[createModeCommand()]}
				setChatInput={setChatInput}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /@Reviewer/i }));

		expect(mocks.store.setSelectedAgentId).toHaveBeenCalledWith("agent-1");
		expect(mocks.store.setChatMode).toHaveBeenCalledWith("agent");
		expect(setChatInput).toHaveBeenCalledWith("review this");
	});

	it("hides agents when a non-chat mode is active", () => {
		render(
			<ComposerCommandButton
				chatInput=""
				directive={null}
				modeCommands={[
					createModeCommand({ id: "chat", label: "Chat", command: "chat", isActive: false }),
					createModeCommand({
						id: "sandbox",
						label: "Sandbox",
						command: "sandbox",
						isActive: true,
					}),
				]}
				setChatInput={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open commands" }));

		expect(screen.queryByText("Agents")).not.toBeInTheDocument();
		expect(screen.queryByText("Reviewer")).not.toBeInTheDocument();
	});

	it("shows slash settings commands", () => {
		const scrollIntoView = vi.fn();
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: scrollIntoView,
		});

		render(
			<ComposerCommandSuggestions
				chatInput="/verb"
				directive={{ trigger: "/", query: "verb", start: 0, end: 5 }}
				modeCommands={[createModeCommand()]}
				activeSuggestionIndex={1}
				setChatInput={vi.fn()}
			/>,
		);

		const highlighted = screen.getByTitle("Verbosity: Medium");

		expect(highlighted).toBeInTheDocument();
		expect(highlighted).toHaveClass("bg-blue-50");
		return waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" }));
	});
});
