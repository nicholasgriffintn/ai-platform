import { act, renderHook } from "@testing-library/react";
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
		selectedAssistantAction: null as {
			verb?: "run" | "schedule";
			item?: {
				id: string;
				kind: "connector" | "recipe";
				label: string;
				metadata?: {
					recipeId?: string;
				};
			};
			tokenPosition?: number;
		} | null,
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
			kind: "connector" | "recipe";
			label: string;
			description: string;
			metadata?: {
				recipeId?: string;
			};
			searchText: string[];
		}>,
	},
}));

vi.mock("~/hooks/useAgents", () => ({
	useAgents: () => ({
		chatAgents: [],
		isLoadingAgents: false,
	}),
}));

vi.mock("~/hooks/useAssistantActionCatalog", () => ({
	useAssistantActionCatalog: () => mocks.actionCatalog,
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

describe("useComposerCommandController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.store.chatInput = "/c";
		mocks.store.chatMode = "remote";
		mocks.store.selectedAgentId = null;
		mocks.store.selectedAssistantAction = null;
		mocks.actionCatalog.verbs = [];
		mocks.actionCatalog.items = [];
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
});
