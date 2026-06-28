import {
	Brain,
	Code,
	Database,
	Image,
	Layers,
	Link,
	ListFilter,
	Search,
	Terminal,
	type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import type { AssistantActionItem, AssistantActionVerbId } from "@assistant/schemas";

import { useAssistantActionCatalog } from "~/hooks/useAssistantActionCatalog";
import { useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { applyModelResponseDefaults } from "~/lib/chat-settings";
import {
	appendComposerInlineTokenWithCursor,
	type ComposerDirectiveQuery,
	matchesComposerCommand,
	removeComposerDirective,
	replaceComposerDirectiveWithCursor,
} from "~/lib/composer-commands";
import { getAvailableModelTools, type ModelToolId } from "~/lib/model-tools";
import { getAvailableModels, defaultModel } from "~/lib/models";
import {
	formatReasoningLabel,
	getDefaultReasoningEffort,
	getReasoningOptions,
} from "~/lib/reasoning";
import { formatVerbosityLabel, getDefaultVerbosity, getVerbosityOptions } from "~/lib/verbosity";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import type { ChatSettings, ReasoningEffort, VerbosityLevel } from "~/types";
import type { ComposerCommandAction, ComposerInlineToken } from "./composerCommandTypes";

const MODEL_TOOL_ICONS: Record<ModelToolId, LucideIcon> = {
	code_execution: Code,
	hosted_shell: Terminal,
	image_generation: Image,
	search_grounding: Search,
	tool_search: ListFilter,
	web_fetch: Link,
};

export interface AgentCommand {
	id: string;
	name: string;
	description?: string;
	avatar_url?: string;
	model?: string;
	enabled_tools?: string[];
	is_team_agent?: boolean;
}

export function useComposerCommandActions({
	chatInput,
	directive,
	includeSettingCommands = true,
	modeCommands,
	setChatInput,
}: {
	chatInput: string;
	directive: ComposerDirectiveQuery | null;
	includeSettingCommands?: boolean;
	modeCommands: ComposerCommandAction[];
	setChatInput: (value: string) => void;
}) {
	const {
		chatMode,
		chatSettings,
		isPro,
		model,
		selectedAssistantAction,
		selectedAgentId,
		setChatMode,
		setChatSettings,
		setModel,
		setSelectedAssistantAction,
		setSelectedAgentId,
		setSelectedAgentTokenPosition,
		setUseMultiModel,
		useMultiModel,
	} = useChatStore();
	const { chatAgents, isLoadingAgents } = useAgents();
	const agents = chatAgents as AgentCommand[];
	const { data: apiModels = {} } = useModels();
	const webLLMModels = useWebLLMModels();
	const selectedTools = useToolsStore((state) => state.selectedTools);
	const setSelectedTools = useToolsStore((state) => state.setSelectedTools);

	const availableModels = useMemo(
		() => getAvailableModels(apiModels, true, webLLMModels),
		[apiModels, webLLMModels],
	);
	const selectedModelConfig = model ? availableModels[model] : undefined;
	const modelCapabilities = model ? apiModels[model] : undefined;
	const reasoningOptions = useMemo(
		() => getReasoningOptions(selectedModelConfig),
		[selectedModelConfig],
	);
	const defaultReasoningEffort = getDefaultReasoningEffort(selectedModelConfig);
	const selectedReasoning = chatSettings.reasoning?.effort ?? defaultReasoningEffort;
	const verbosityOptions = useMemo(
		() => getVerbosityOptions(selectedModelConfig),
		[selectedModelConfig],
	);
	const defaultVerbosity = getDefaultVerbosity(selectedModelConfig);
	const selectedVerbosity = chatSettings.verbosity ?? defaultVerbosity;
	const availableModelTools = useMemo(
		() => (modelCapabilities?.supportsToolCalls ? getAvailableModelTools(modelCapabilities) : []),
		[modelCapabilities],
	);
	const actionCatalog = useAssistantActionCatalog({ modelTools: availableModelTools });
	const canUseAgents =
		modeCommands.length === 0 ||
		!modeCommands.some((command) => command.isActive && command.command !== "chat");
	const toolSelectionLocked = chatMode === "agent" && selectedAgentId !== null;

	const selectModelWithDefaults = useCallback(
		(nextModel: string | null, settings: ChatSettings = chatSettings) => {
			setModel(nextModel);
			setChatSettings(
				applyModelResponseDefaults(settings, nextModel ? apiModels[nextModel] : undefined),
			);
		},
		[apiModels, chatSettings, setChatSettings, setModel],
	);

	const consumeDirective = useCallback(() => {
		if (!directive) {
			return;
		}
		setChatInput(removeComposerDirective(chatInput, directive));
	}, [chatInput, directive, setChatInput]);

	const clearAgent = useCallback(() => {
		setSelectedAgentId(null);
		setSelectedAgentTokenPosition(null);
		if (chatMode === "agent") {
			setChatMode("remote");
			selectModelWithDefaults(defaultModel, {
				...chatSettings,
				localOnly: false,
			});
		}
	}, [
		chatMode,
		chatSettings,
		selectModelWithDefaults,
		setChatMode,
		setSelectedAgentId,
		setSelectedAgentTokenPosition,
	]);

	const toggleTool = useCallback(
		(toolId: string) => {
			setSelectedTools(
				selectedTools.includes(toolId)
					? selectedTools.filter((selectedTool) => selectedTool !== toolId)
					: [...selectedTools, toolId],
			);
		},
		[selectedTools, setSelectedTools],
	);

	const clearAssistantAction = useCallback(
		() => setSelectedAssistantAction(null),
		[setSelectedAssistantAction],
	);

	const actionVerbCommands = useMemo<ComposerCommandAction[]>(
		() =>
			actionCatalog.verbs.map((verb) => ({
				id: `action-${verb.id}`,
				label: verb.label,
				description: verb.description,
				command: verb.command,
				icon: <ListFilter className="h-4 w-4" aria-hidden="true" />,
				isActive: false,
				selectionText: "@",
				selectionCursorOffset: 1,
				onSelect: () => undefined,
			})),
		[actionCatalog.verbs],
	);

	const settingCommands = useMemo<ComposerCommandAction[]>(() => {
		if (!includeSettingCommands) {
			return [];
		}

		const commands: ComposerCommandAction[] = [
			...verbosityOptions.map((option) => ({
				id: `verbosity-${option}`,
				label: `Verbosity: ${formatVerbosityLabel(option)}`,
				description: "Choose how detailed responses should be.",
				command: `verbosity ${option}`,
				icon: <ListFilter className="h-4 w-4" aria-hidden="true" />,
				isActive: selectedVerbosity === option,
				onSelect: () =>
					setChatSettings({
						...chatSettings,
						verbosity: option as VerbosityLevel,
					}),
			})),
			...reasoningOptions.map((option) => ({
				id: `reasoning-${option}`,
				label: `Reasoning: ${formatReasoningLabel(option)}`,
				description: "Choose configured thinking depth.",
				command: `reasoning ${option}`,
				icon: <Brain className="h-4 w-4" aria-hidden="true" />,
				isActive: selectedReasoning === option,
				onSelect: () =>
					setChatSettings({
						...chatSettings,
						reasoning:
							option === "none"
								? undefined
								: {
										...chatSettings.reasoning,
										effort: option as ReasoningEffort,
									},
					}),
			})),
			{
				id: "rag-toggle",
				label: chatSettings.use_rag ? "Disable RAG" : "Enable RAG",
				description: "Toggle retrieval-augmented generation.",
				command: "rag",
				icon: <Database className="h-4 w-4" aria-hidden="true" />,
				isActive: Boolean(chatSettings.use_rag),
				onSelect: () =>
					setChatSettings({
						...chatSettings,
						use_rag: !chatSettings.use_rag,
					}),
			},
		];

		if (isPro && !model && chatMode === "remote") {
			commands.push({
				id: "multi-model-toggle",
				label: useMultiModel ? "Disable multi-model" : "Enable multi-model",
				description: "Use multiple models when useful.",
				command: "multi-model",
				icon: <Layers className="h-4 w-4" aria-hidden="true" />,
				isActive: useMultiModel,
				onSelect: () => setUseMultiModel(!useMultiModel),
			});
		}

		if (availableModelTools.length > 0) {
			for (const tool of availableModelTools) {
				const Icon = MODEL_TOOL_ICONS[tool.id];
				commands.push({
					id: `${tool.id}-toggle`,
					label: selectedTools.includes(tool.id)
						? `Disable ${tool.command}`
						: `Enable ${tool.command}`,
					description: tool.description,
					command: tool.command,
					icon: <Icon className="h-4 w-4" aria-hidden="true" />,
					isActive: selectedTools.includes(tool.id),
					disabled: toolSelectionLocked,
					disabledReason: "Agent tools are controlled by the selected agent.",
					onSelect: () => toggleTool(tool.id),
				});
			}
		}

		return commands;
	}, [
		chatMode,
		chatSettings,
		availableModelTools,
		defaultReasoningEffort,
		defaultVerbosity,
		includeSettingCommands,
		isPro,
		model,
		reasoningOptions,
		selectedReasoning,
		selectedTools,
		selectedVerbosity,
		setChatSettings,
		setUseMultiModel,
		toggleTool,
		toolSelectionLocked,
		useMultiModel,
		verbosityOptions,
	]);

	const inlineSkillTokens = useMemo<ComposerInlineToken[]>(() => {
		const tokens: ComposerInlineToken[] = [];

		for (const tool of availableModelTools) {
			if (!selectedTools.includes(tool.id)) {
				continue;
			}
			const Icon = MODEL_TOOL_ICONS[tool.id];
			tokens.push({
				id: `tool-${tool.id}`,
				label: tool.command,
				icon: <Icon className="h-3.5 w-3.5" aria-hidden="true" />,
				...(toolSelectionLocked
					? {}
					: {
							onClear: () =>
								setSelectedTools(selectedTools.filter((selectedTool) => selectedTool !== tool.id)),
						}),
			});
		}

		return tokens;
	}, [availableModelTools, selectedTools, setSelectedTools, toolSelectionLocked]);

	const slashCommands = useMemo(
		() => [...actionVerbCommands, ...modeCommands, ...settingCommands],
		[actionVerbCommands, modeCommands, settingCommands],
	);
	const filteredSlashCommands = useMemo(() => {
		const query = directive?.trigger === "/" ? directive.query : "";
		return slashCommands.filter((command) =>
			matchesComposerCommand(query, [command.label, command.command, command.description]),
		);
	}, [directive, slashCommands]);
	const filteredActionItems = useMemo(() => {
		const query = directive?.trigger === "@" ? directive.query : "";
		if (!canUseAgents) {
			return [];
		}
		return actionCatalog.items.filter((item) =>
			matchesComposerCommand(query, [
				item.label,
				item.description,
				item.status,
				...item.searchText,
			]),
		);
	}, [actionCatalog.items, canUseAgents, directive]);

	const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

	const selectSlashCommand = useCallback(
		(command: ComposerCommandAction) => {
			if (command.disabled) {
				return undefined;
			}
			if (command.selectionText && directive) {
				if (command.id.startsWith("action-")) {
					setSelectedAssistantAction({
						...selectedAssistantAction,
						verb: command.command as AssistantActionVerbId,
					});
				}
				const selection = replaceComposerDirectiveWithCursor(
					chatInput,
					directive,
					command.selectionText,
					command.selectionCursorOffset,
				);
				setChatInput(selection.input);
				return selection;
			}
			command.onSelect();
			if (command.command !== "chat" && modeCommands.some((mode) => mode.id === command.id)) {
				clearAgent();
			}
			consumeDirective();
			return undefined;
		},
		[
			chatInput,
			clearAgent,
			consumeDirective,
			directive,
			modeCommands,
			selectedAssistantAction,
			setChatInput,
			setSelectedAssistantAction,
		],
	);

	const selectAgent = useCallback(
		(agent: AgentCommand) => {
			if (!canUseAgents) {
				return undefined;
			}
			setSelectedAgentId(agent.id);
			const selection = directive
				? replaceComposerDirectiveWithCursor(chatInput, directive, `@${agent.name}`, {
						appendTrailingSpace: true,
					})
				: appendComposerInlineTokenWithCursor(chatInput, agent.name);
			setSelectedAgentTokenPosition(selection.replacementStart);
			setChatMode("agent");
			selectModelWithDefaults(agent.model ?? defaultModel, {
				...chatSettings,
				localOnly: false,
			});
			setChatInput(selection.input);
			return selection;
		},
		[
			canUseAgents,
			chatInput,
			chatSettings,
			directive,
			selectModelWithDefaults,
			setChatMode,
			setChatInput,
			setSelectedAgentId,
			setSelectedAgentTokenPosition,
		],
	);

	const selectActionItem = useCallback(
		(item: AssistantActionItem) => {
			if (!canUseAgents) {
				return undefined;
			}
			if (item.kind === "agent") {
				const agentId = item.id.replace(/^agent:/, "");
				const agent = agents.find((item) => item.id === agentId);
				if (agent) {
					return selectAgent(agent);
				}
				return undefined;
			}
			const selection = directive
				? replaceComposerDirectiveWithCursor(chatInput, directive, `@${item.label}`, {
						appendTrailingSpace: true,
					})
				: appendComposerInlineTokenWithCursor(chatInput, item.label);
			setSelectedAssistantAction({
				...selectedAssistantAction,
				item: {
					id: item.id,
					kind: item.kind,
					label: item.label,
					launch: item.launch,
					metadata: item.metadata,
				},
				tokenPosition: selection.replacementStart,
			});
			setChatInput(selection.input);
			return selection;
		},
		[
			agents,
			canUseAgents,
			chatInput,
			directive,
			selectAgent,
			selectedAssistantAction,
			setChatInput,
			setSelectedAssistantAction,
		],
	);

	return {
		agents,
		actionItems: actionCatalog.items,
		canUseAgents,
		clearAgent,
		clearAssistantAction,
		filteredActionItems,
		filteredSlashCommands,
		inlineSkillTokens,
		isLoadingAgents,
		modeCommands,
		selectActionItem,
		selectAgent,
		selectSlashCommand,
		selectedAssistantAction,
		selectedAgent,
		selectedAgentId,
		settingCommands,
		slashCommands,
	};
}
