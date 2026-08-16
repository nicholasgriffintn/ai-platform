import { act, renderHook } from "@testing-library/react";
import type { AssistantActionSelection } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useComposerCommandController } from "./useComposerCommandController";

const mocks = vi.hoisted(() => ({
	store: {
		chatInput: "/c",
		chatMode: "remote",
		chatSettings: {},
		isPro: true,
		model: null as string | null,
		selectedAgentId: null as string | null,
		selectedAgentTokenPosition: null as number | null,
		selectedAssistantAction: null as AssistantActionSelection | null,
		setChatInput: vi.fn(),
		setChatMode: vi.fn(),
		setChatSettings: vi.fn(),
		setModel: vi.fn(),
		setSelectedAssistantAction: vi.fn(),
		setSelectedAgentId: vi.fn(),
		setSelectedAgentTokenPosition: vi.fn(),
		setUseMultiModel: vi.fn(),
		useMultiModel: false,
	},
	actionCatalog: {
		verbs: [] as Array<{
			id: "run";
			command: "run";
			label: string;
			description: string;
		}>,
		items: [] as Array<{
			id: string;
			kind: "connector" | "recipe" | "skill";
			label: string;
			description: string;
			capability?: { id: string };
			metadata?: {
				recipeId?: string;
			};
			searchText: string[];
		}>,
	},
	useAssistantActionCatalog: vi.fn(),
}));

vi.mock("~/hooks/useAgents", () => ({
	useAgents: () => ({
		chatAgents: [],
		isLoadingAgents: false,
	}),
}));

vi.mock("~/hooks/useAssistantActionCatalog", () => ({
	useAssistantActionCatalog: mocks.useAssistantActionCatalog,
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({ data: {} }),
}));

vi.mock("~/hooks/useModelTools", () => ({
	useModelToolOptions: () => [],
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: () => ({}),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => mocks.store,
}));

describe("useComposerCommandController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.store.chatInput = "/c";
		mocks.store.chatMode = "remote";
		mocks.store.selectedAgentId = null;
		mocks.store.selectedAgentTokenPosition = null;
		mocks.store.selectedAssistantAction = null;
		mocks.actionCatalog.verbs = [];
		mocks.actionCatalog.items = [];
		mocks.useAssistantActionCatalog.mockReturnValue(mocks.actionCatalog);
	});

	it("limits project action suggestions to enabled capabilities", () => {
		mocks.store.chatInput = "@";
		mocks.actionCatalog.items = [
			{
				id: "connector:selected",
				kind: "connector",
				label: "Selected connector",
				description: "Shares an ID but is not a project capability",
				capability: { id: "selected" },
				searchText: [],
			},
			{
				id: "recipe:unselected",
				kind: "recipe",
				label: "Unselected recipe",
				description: "Not enabled for this project",
				capability: { id: "unselected" },
				searchText: [],
			},
			{
				id: "recipe:selected",
				kind: "recipe",
				label: "Selected recipe",
				description: "Enabled for this project",
				capability: { id: "selected" },
				searchText: [],
			},
		];
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
				allowedAssistantActionCapabilities: [{ kind: "recipe", capabilityId: "selected" }],
			}),
		);

		act(() => result.current.setTextareaCursorPosition(1));
		act(() => result.current.applyDirectiveSelection());

		expect(mocks.store.setSelectedAssistantAction).toHaveBeenCalledWith(
			expect.objectContaining({
				item: expect.objectContaining({ id: "recipe:selected" }),
			}),
		);
	});

	it("moves through slash suggestions with wraparound", () => {
		const first = vi.fn();
		const second = vi.fn();
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
				modeControls: {
					commands: [
						{
							id: "chat",
							label: "Chat",
							description: "Standard chat",
							command: "chat",
							icon: null,
							isActive: true,
							onSelect: first,
						},
						{
							id: "council",
							label: "Council",
							description: "Debate with council",
							command: "council",
							icon: null,
							isActive: false,
							onSelect: second,
						},
					],
				},
			}),
		);

		act(() => result.current.setTextareaCursorPosition(2));
		act(() => result.current.moveActiveSuggestion(1));
		act(() => result.current.applyDirectiveSelection());

		expect(second).toHaveBeenCalledTimes(1);
	});

	it("selects non-agent action items as structured composer state", () => {
		mocks.store.chatInput = "ask @post about signups";
		mocks.actionCatalog.items = [
			{
				id: "connector:posthog",
				kind: "connector",
				label: "PostHog",
				description: "Query product analytics.",
				searchText: ["PostHog", "query"],
			},
		];
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
			}),
		);

		act(() => result.current.setTextareaCursorPosition(9));
		act(() => result.current.applyDirectiveSelection());

		expect(mocks.store.setSelectedAssistantAction).toHaveBeenCalledWith({
			item: {
				id: "connector:posthog",
				kind: "connector",
				label: "PostHog",
				metadata: undefined,
			},
			tokenPosition: 4,
			tokenText: "@PostHog",
		});
		expect(mocks.store.setChatInput).toHaveBeenCalledWith("ask @PostHog about signups");
		expect(mocks.store.setSelectedAgentId).not.toHaveBeenCalled();
	});

	it("keeps the selected slash verb when choosing an assistant action item", () => {
		mocks.store.chatInput = "@mor tomorrow";
		mocks.store.selectedAssistantAction = { verb: "schedule" };
		mocks.actionCatalog.items = [
			{
				id: "recipe:morning-briefing",
				kind: "recipe",
				label: "Morning Briefing",
				description: "Summarise your day.",
				metadata: {
					recipeId: "morning-briefing",
				},
				searchText: ["Morning Briefing"],
			},
		];
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
			}),
		);

		act(() => result.current.setTextareaCursorPosition(4));
		act(() => result.current.applyDirectiveSelection());

		expect(mocks.store.setSelectedAssistantAction).toHaveBeenCalledWith({
			verb: "schedule",
			item: {
				id: "recipe:morning-briefing",
				kind: "recipe",
				label: "Morning Briefing",
				metadata: {
					recipeId: "morning-briefing",
				},
			},
			tokenPosition: 0,
			tokenText: "@Morning Briefing",
		});
		expect(mocks.store.setChatInput).toHaveBeenCalledWith("@Morning Briefing tomorrow");
	});

	it("turns action verb commands into structured state and opens item selection", () => {
		mocks.store.chatInput = "/r";
		mocks.actionCatalog.verbs = [
			{
				id: "run",
				command: "run",
				label: "Run",
				description: "Run an action.",
			},
		];
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
			}),
		);

		act(() => result.current.setTextareaCursorPosition(2));
		act(() => result.current.applyDirectiveSelection());

		expect(mocks.store.setSelectedAssistantAction).toHaveBeenCalledWith({ verb: "run" });
		expect(mocks.store.setChatInput).toHaveBeenCalledWith("@");
	});

	it("inserts a skill slash suggestion as structured action state", () => {
		mocks.store.chatInput = "/i-have";
		mocks.actionCatalog.items = [
			{
				id: "skill:i-have-adhd",
				kind: "skill",
				label: "i-have-adhd",
				description: "Shape output for a reader with ADHD.",
				capability: { id: "i-have-adhd" },
				searchText: ["i-have-adhd", "ADHD"],
			},
		];
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
			}),
		);

		act(() => result.current.setTextareaCursorPosition(7));
		act(() => result.current.applyDirectiveSelection());

		expect(mocks.store.setChatInput).toHaveBeenCalledWith("/i-have-adhd ");
		expect(mocks.store.setSelectedAssistantAction).toHaveBeenCalledWith({
			item: {
				id: "skill:i-have-adhd",
				kind: "skill",
				label: "i-have-adhd",
				metadata: undefined,
			},
			tokenPosition: 0,
			tokenText: "/i-have-adhd",
		});
	});

	it("lets exact self-inserting slash commands submit instead of reselecting forever", () => {
		mocks.store.chatInput = "/compact";
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
			}),
		);

		act(() => result.current.setTextareaCursorPosition(8));

		expect(result.current.applyDirectiveSelection()).toBe(false);
		expect(mocks.store.setChatInput).not.toHaveBeenCalled();
	});

	it("lets exact self-inserting slash commands submit when cursor state still points at the partial command", () => {
		mocks.store.chatInput = "/compact";
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
			}),
		);

		act(() => result.current.setTextareaCursorPosition(4));

		expect(result.current.applyDirectiveSelection()).toBe(false);
		expect(mocks.store.setChatInput).not.toHaveBeenCalled();
	});

	it("does not open action suggestions from inside an already selected inline token", () => {
		mocks.store.chatInput = "hey @Daily Weather and";
		mocks.store.selectedAssistantAction = {
			item: {
				id: "recipe:daily-weather",
				kind: "recipe",
				label: "Daily Weather",
			},
			tokenPosition: 4,
		};
		mocks.actionCatalog.items = [
			{
				id: "recipe:daily-weather",
				kind: "recipe",
				label: "Daily Weather",
				description: "Get a local forecast.",
				searchText: ["Daily Weather"],
			},
		];
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
			}),
		);

		act(() => result.current.setTextareaCursorPosition(5));

		expect(result.current.directiveQuery).toBeNull();
		expect(result.current.commandState.directive).toBeNull();
	});

	it("does not reopen action suggestions when cursor state drifts into selected inline text", () => {
		mocks.store.chatInput = "hey @Daily Weather and";
		mocks.store.selectedAssistantAction = {
			item: {
				id: "recipe:daily-weather",
				kind: "recipe",
				label: "Daily Weather",
			},
			tokenPosition: 99,
		};
		mocks.actionCatalog.items = [
			{
				id: "recipe:daily-weather",
				kind: "recipe",
				label: "Daily Weather",
				description: "Get a local forecast.",
				searchText: ["Daily Weather"],
			},
		];
		const { result } = renderHook(() =>
			useComposerCommandController({
				isLoading: false,
			}),
		);

		act(() => result.current.setTextareaCursorPosition(5));

		expect(result.current.directiveQuery).toBeNull();
		expect(result.current.commandState.directive).toBeNull();
	});
});
