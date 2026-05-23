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

import { useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { applyModelResponseDefaults } from "~/lib/chat-settings";
import {
	type ComposerDirectiveQuery,
	matchesComposerCommand,
	removeComposerDirective,
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
import type { ComposerCommandAction } from "./composerCommandTypes";

const MODEL_TOOL_ICONS: Record<ModelToolId, LucideIcon> = {
	code_execution: Code,
	hosted_shell: Terminal,
	image_generation: Image,
	search_grounding: Search,
	tool_search: ListFilter,
	web_fetch: Link,
};

interface AgentCommand {
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
	modeCommands,
	setChatInput,
}: {
	chatInput: string;
	directive: ComposerDirectiveQuery | null;
	modeCommands: ComposerCommandAction[];
	setChatInput: (value: string) => void;
}) {
	const {
		chatMode,
		chatSettings,
		isPro,
		model,
		selectedAgentId,
		setChatMode,
		setChatSettings,
		setModel,
		setSelectedAgentId,
		setUseMultiModel,
		useMultiModel,
	} = useChatStore();
	const { chatAgents, isLoadingAgents } = useAgents();
	const agents = chatAgents as AgentCommand[];
	const { data: apiModels = {} } = useModels();
	const webLLMModels = useWebLLMModels();
	const selectedTools = useToolsStore((state) => state.selectedTools);
	const setSelectedTools = useToolsStore((state) => state.setSelectedTools);

	const availableModels = getAvailableModels(apiModels, true, webLLMModels);
	const selectedModelConfig = model ? availableModels[model] : undefined;
	const modelCapabilities = model ? apiModels[model] : undefined;
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
		if (chatMode === "agent") {
			setChatMode("remote");
			selectModelWithDefaults(defaultModel, {
				...chatSettings,
				localOnly: false,
			});
		}
	}, [chatMode, chatSettings, selectModelWithDefaults, setChatMode, setSelectedAgentId]);

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

	const settingCommands = useMemo<ComposerCommandAction[]>(() => {
		const reasoningOptions = getReasoningOptions(selectedModelConfig);
		const defaultReasoningEffort = getDefaultReasoningEffort(selectedModelConfig);
		const selectedReasoning = chatSettings.reasoning?.effort ?? defaultReasoningEffort;
		const verbosityOptions = getVerbosityOptions(selectedModelConfig);
		const defaultVerbosity = getDefaultVerbosity(selectedModelConfig);
		const selectedVerbosity = chatSettings.verbosity ?? defaultVerbosity;
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

		if (modelCapabilities?.supportsToolCalls) {
			for (const tool of getAvailableModelTools(modelCapabilities)) {
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
		isPro,
		model,
		modelCapabilities,
		selectedModelConfig,
		selectedTools,
		setChatSettings,
		setUseMultiModel,
		toggleTool,
		toolSelectionLocked,
		useMultiModel,
	]);

	const slashCommands = useMemo(
		() => [...modeCommands, ...settingCommands],
		[modeCommands, settingCommands],
	);
	const filteredSlashCommands = useMemo(() => {
		const query = directive?.trigger === "/" ? directive.query : "";
		return slashCommands.filter((command) =>
			matchesComposerCommand(query, [command.label, command.command, command.description]),
		);
	}, [directive, slashCommands]);
	const filteredAgents = useMemo(() => {
		const query = directive?.trigger === "@" ? directive.query : "";
		if (!canUseAgents) {
			return [];
		}
		return agents.filter((agent) =>
			matchesComposerCommand(query, [agent.name, agent.description, agent.model]),
		);
	}, [agents, canUseAgents, directive]);

	const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

	const selectSlashCommand = useCallback(
		(command: ComposerCommandAction) => {
			if (command.disabled) {
				return;
			}
			command.onSelect();
			if (command.command !== "chat" && modeCommands.some((mode) => mode.id === command.id)) {
				clearAgent();
			}
			consumeDirective();
		},
		[clearAgent, consumeDirective, modeCommands],
	);

	const selectAgent = useCallback(
		(agent: AgentCommand) => {
			if (!canUseAgents) {
				return;
			}
			setSelectedAgentId(agent.id);
			setChatMode("agent");
			selectModelWithDefaults(agent.model ?? defaultModel, {
				...chatSettings,
				localOnly: false,
			});
			consumeDirective();
		},
		[
			canUseAgents,
			chatSettings,
			consumeDirective,
			selectModelWithDefaults,
			setChatMode,
			setSelectedAgentId,
		],
	);

	return {
		agents,
		canUseAgents,
		clearAgent,
		filteredAgents,
		filteredSlashCommands,
		isLoadingAgents,
		modeCommands,
		selectAgent,
		selectSlashCommand,
		selectedAgent,
		selectedAgentId,
		settingCommands,
		slashCommands,
	};
}
