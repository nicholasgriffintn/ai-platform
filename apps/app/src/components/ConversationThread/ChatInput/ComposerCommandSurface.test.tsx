import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AssistantActionSelection } from "@assistant/schemas";
import { useState } from "react";
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
		selectedAssistantAction: null as AssistantActionSelection | null,
		selectedAgentId: null as string | null,
		selectedAgentTokenPosition: null as number | null,
		setChatMode: vi.fn(),
		setChatSettings: vi.fn(),
		setModel: vi.fn(),
		setSelectedAssistantAction: vi.fn(),
		setSelectedAgentId: vi.fn(),
		setSelectedAgentTokenPosition: vi.fn(),
		setUseMultiModel: vi.fn(),
		useMultiModel: false,
	},
	toolsStore: {
		selectedTools: [] as string[],
		setSelectedTools: vi.fn(),
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

vi.mock("~/hooks/useConnectors", () => ({
	useRecipeConnectors: () => ({
		data: {
			connectors: [
				{
					id: "posthog",
					name: "PostHog",
					description: "Query product analytics",
					authType: "api_key",
					status: "connected",
					scopes: ["project:read"],
					operations: ["query"],
				},
			],
		},
	}),
}));

vi.mock("~/hooks/useDynamicApps", () => ({
	useDynamicApps: () => ({
		data: {
			apps: [
				{
					id: "articles",
					name: "Article Research",
					description: "Analyse articles",
					category: "Research",
					kind: "dynamic",
					type: "normal",
				},
			],
		},
	}),
}));

vi.mock("~/hooks/useRecipes", () => ({
	useAssistantRecipes: () => ({
		data: {
			recipes: [
				{
					id: "morning-briefing",
					title: "Morning Briefing",
					summary: "Summarise your day",
					description: "Uses mail and calendar",
					kind: "automate",
					category: "Productivity",
					featured: true,
					estimatedSetupMinutes: 5,
					integrations: [],
					triggers: [{ type: "message", label: "Ask", description: "Ask for it" }],
					actions: ["Summarise priorities"],
					setupPrompt: "Set up the Morning Briefing recipe.",
					enabledTools: ["use_recipe_connector"],
					configurationFields: [],
				},
			],
		},
	}),
	useRecipeInstallations: () => ({
		data: {
			installations: [
				{
					id: "installation-1",
					recipeId: "morning-briefing",
					userId: 42,
					status: "active",
					triggers: [{ type: "manual", enabled: true }],
					configuration: {},
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
				},
			],
		},
	}),
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({
		data: {
			"tool-model": {
				id: "tool-model",
				matchingModel: "tool-model",
				provider: "test",
				supportsToolCalls: true,
				supportsWebFetch: true,
			},
		},
	}),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: () => ({}),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => mocks.store,
}));

vi.mock("~/state/stores/toolsStore", () => ({
	useToolsStore: (selector: (state: typeof mocks.toolsStore) => unknown) =>
		selector(mocks.toolsStore),
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
		mocks.store.chatSettings = {};
		mocks.store.model = null;
		mocks.store.selectedAssistantAction = null;
		mocks.store.selectedAgentId = null;
		mocks.store.selectedAgentTokenPosition = null;
		mocks.toolsStore.selectedTools = [];
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

	it("selects action items from the compact command button without an active directive", () => {
		const setChatInput = vi.fn();

		render(
			<ComposerCommandButton
				chatInput="ask"
				directive={null}
				modeCommands={[createModeCommand()]}
				setChatInput={setChatInput}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open commands" }));
		fireEvent.click(screen.getByRole("button", { name: /PostHog/i }));

		expect(mocks.store.setSelectedAssistantAction).toHaveBeenCalledWith({
			item: {
				id: "connector:posthog",
				kind: "connector",
				label: "PostHog",
				launch: {
					kind: "navigation",
					path: "/profile?tab=providers&type=connector&connector=posthog",
				},
				metadata: expect.objectContaining({
					provider: "posthog",
				}),
			},
			tokenPosition: 4,
		});
		expect(setChatInput).toHaveBeenCalledWith("ask @PostHog ");
	});

	it("routes compact action item selection through the controller callback when provided", () => {
		const onActionItemSelect = vi.fn();

		render(
			<ComposerCommandButton
				chatInput="ask"
				directive={null}
				modeCommands={[createModeCommand()]}
				onActionItemSelect={onActionItemSelect}
				setChatInput={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open commands" }));
		fireEvent.click(screen.getByRole("button", { name: /PostHog/i }));

		expect(onActionItemSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "connector:posthog",
				label: "PostHog",
			}),
		);
		expect(mocks.store.setSelectedAssistantAction).not.toHaveBeenCalled();
	});

	it("selects agents from the compact command button into inline prompt text", () => {
		const setChatInput = vi.fn();

		render(
			<ComposerCommandButton
				chatInput="ask"
				directive={null}
				modeCommands={[createModeCommand()]}
				setChatInput={setChatInput}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open commands" }));
		fireEvent.click(screen.getByRole("button", { name: /Reviewer/i }));

		expect(mocks.store.setSelectedAgentId).toHaveBeenCalledWith("agent-1");
		expect(mocks.store.setSelectedAgentTokenPosition).toHaveBeenCalledWith(4);
		expect(setChatInput).toHaveBeenCalledWith("ask @Reviewer ");
	});

	it("keeps the compact command popover open after selecting live mode", () => {
		function LiveCommandHarness() {
			const [isLiveMode, setIsLiveMode] = useState(false);
			const command = createModeCommand({
				id: "live",
				label: "Live",
				description: "Talk with the model in realtime",
				command: "live",
				isActive: isLiveMode,
				keepPopoverOpen: true,
				onSelect: () => setIsLiveMode(true),
			});

			return (
				<ComposerCommandButton
					activeModeControls={isLiveMode ? <div>Live provider controls</div> : undefined}
					chatInput=""
					directive={null}
					modeCommands={[command]}
					setChatInput={vi.fn()}
				/>
			);
		}

		render(<LiveCommandHarness />);

		fireEvent.click(screen.getByRole("button", { name: "Open commands" }));
		fireEvent.click(screen.getByRole("button", { name: /Live/i }));

		expect(screen.getByText("Live provider controls")).toBeInTheDocument();
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
				attachments={[
					{
						label: "README.md (converted to text)",
						onClear: vi.fn(),
						preview: <span aria-hidden="true">F</span>,
					},
					{
						label: "SPEC.md (converted to text)",
						onClear: vi.fn(),
						preview: <span aria-hidden="true">F</span>,
					},
				]}
				setChatInput={vi.fn()}
			/>,
		);

		expect(screen.getByText("README.md (converted to text)")).toBeInTheDocument();
		expect(screen.getByText("SPEC.md (converted to text)")).toBeInTheDocument();
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

	it("can hide the selected agent from the stacked chip row when inline tokens render it", () => {
		mocks.store.selectedAgentId = "agent-1";

		render(
			<ComposerCommandChips
				chatInput=""
				directive={null}
				hideAgentChip={true}
				modeCommands={[]}
				setChatInput={vi.fn()}
			/>,
		);

		expect(screen.queryByText("Reviewer")).not.toBeInTheDocument();
	});

	it("selects an agent and keeps the mention in the prompt text", () => {
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
		expect(setChatInput).toHaveBeenCalledWith("@Reviewer review this");
	});

	it("shows action verbs from the assistant action catalogue as slash commands", () => {
		render(
			<ComposerCommandSuggestions
				chatInput="/ru"
				directive={{ trigger: "/", query: "ru", start: 0, end: 3 }}
				modeCommands={[createModeCommand()]}
				setChatInput={vi.fn()}
			/>,
		);

		expect(screen.getByRole("button", { name: /\/run/i })).toBeInTheDocument();
	});

	it("groups recipes, apps, agents, connectors, and tools by their own names", () => {
		mocks.store.model = "tool-model";

		render(
			<ComposerCommandSuggestions
				chatInput="@"
				directive={{ trigger: "@", query: "", start: 0, end: 1 }}
				modeCommands={[createModeCommand()]}
				setChatInput={vi.fn()}
			/>,
		);

		expect(screen.getByText("Recipes")).toBeInTheDocument();
		expect(screen.getByText("Apps")).toBeInTheDocument();
		expect(screen.getByText("Agents")).toBeInTheDocument();
		expect(screen.getByText("Connectors")).toBeInTheDocument();
		expect(screen.getByText("Tools")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /@Morning Briefing/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /@Article Research/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /@PostHog/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /@Reviewer/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /@Web fetch/i })).toBeInTheDocument();
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
