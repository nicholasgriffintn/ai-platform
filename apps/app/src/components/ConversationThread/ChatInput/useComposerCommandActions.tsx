import {
  type ComposerActionCatalogConfig,
  type ComposerAssistantActionCapability,
  type ComposerCommandAction,
} from "@ngriffin_uk/polychat-component-conversation";
import { COMPACT_CONVERSATION_COMMAND } from "@ngriffin_uk/polychat-library-chat/compaction-command";
import {
  appendComposerInlineTokenWithCursor,
  type ComposerDirectiveQuery,
  getComposerInlineTokenText,
  matchesComposerCommand,
  removeComposerDirective,
  replaceComposerDirectiveWithCursor,
} from "@ngriffin_uk/polychat-library-chat/composer-commands";
import type { ModelToolId } from "@ngriffin_uk/polychat-library-chat/model-tools";
import {
  formatVerbosityLabel,
  getDefaultVerbosity,
  getVerbosityOptions,
} from "@ngriffin_uk/polychat-library-chat/verbosity";
import {
  defaultModel,
  EMPTY_MODEL_CONFIG,
  formatReasoningLabel,
  getAvailableModels,
  getDefaultReasoningEffort,
  getReasoningOptions,
} from "@ngriffin_uk/polychat-schemas";
import type {
  AssistantActionItem,
  AssistantActionItemKind,
  AssistantActionVerbId,
  ProjectCapabilityKind,
} from "@ngriffin_uk/polychat-schemas";
import {
  Archive,
  BookOpen,
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
import { useAssistantActionCatalog } from "~/hooks/useAssistantActionCatalog";
import { useModels } from "~/hooks/useModels";
import { useModelToolOptions } from "~/hooks/useModelTools";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { applyModelResponseDefaults } from "~/lib/chat-settings";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import type { ChatSettings, ReasoningEffort, VerbosityLevel } from "~/types";

const PROJECT_CAPABILITY_KIND_BY_ACTION_KIND: Partial<
  Record<AssistantActionItemKind, ProjectCapabilityKind>
> = {
  app: "app",
  installed_recipe: "recipe",
  recipe: "recipe",
  skill: "skill",
  tool: "tool",
};

const MODEL_TOOL_ICONS: Record<ModelToolId, LucideIcon> = {
  code_execution: Code,
  file_search: Database,
  hosted_shell: Terminal,
  image_generation: Image,
  mcp: ListFilter,
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
  allowedAssistantActionCapabilities,
  assistantActionCatalog,
  chatInput,
  directive,
  includeSettingCommands = true,
  modeCommands,
  setChatInput,
  toolSelectionLocked: toolSelectionLockedOverride = false,
}: {
  allowedAssistantActionCapabilities?: readonly ComposerAssistantActionCapability[];
  assistantActionCatalog?: ComposerActionCatalogConfig;
  chatInput: string;
  directive: ComposerDirectiveQuery | null;
  includeSettingCommands?: boolean;
  modeCommands: ComposerCommandAction[];
  setChatInput: (value: string) => void;
  toolSelectionLocked?: boolean;
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
  const includeAgents = assistantActionCatalog?.includeAgents !== false;
  const { chatAgents, isLoadingAgents } = useAgents({ enabled: includeAgents });
  const agents = chatAgents as AgentCommand[];
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const webLLMModels = useWebLLMModels({ enabled: chatMode === "local" });
  const selectedTools = useToolsStore((state) => state.selectedTools);
  const setSelectedTools = useToolsStore((state) => state.setSelectedTools);

  const availableModels = useMemo(
    () => getAvailableModels(apiModels, chatMode === "local", webLLMModels),
    [apiModels, chatMode, webLLMModels],
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
  const modelToolOptions = useModelToolOptions(modelCapabilities);
  const availableModelTools = useMemo(
    () => modelToolOptions.filter((tool) => tool.available),
    [modelToolOptions],
  );
  const actionCatalog = useAssistantActionCatalog({
    includeAgents,
    modelTools: assistantActionCatalog?.includeTools === false ? [] : availableModelTools,
    projectId: assistantActionCatalog?.projectId,
  });
  const canUseAgents =
    modeCommands.length === 0 ||
    !modeCommands.some((command) => command.isActive && command.command !== "chat");
  const toolSelectionLocked =
    toolSelectionLockedOverride || (chatMode === "agent" && selectedAgentId !== null);
  const allowedActionItems = useMemo(() => {
    if (!canUseAgents) return [];
    if (!allowedAssistantActionCapabilities) return actionCatalog.items;

    const allowedCapabilityIdsByKind = new Map<ProjectCapabilityKind, Set<string>>(
      (["app", "recipe", "skill", "tool"] as const).map((kind) => [
        kind,
        new Set(
          allowedAssistantActionCapabilities
            .filter((capability) => capability.kind === kind)
            .map((capability) => capability.capabilityId),
        ),
      ]),
    );

    return actionCatalog.items.filter((item) => {
      const capabilityKind = PROJECT_CAPABILITY_KIND_BY_ACTION_KIND[item.kind];
      return (
        capabilityKind !== undefined &&
        allowedCapabilityIdsByKind.get(capabilityKind)?.has(item.capability.id) === true
      );
    });
  }, [actionCatalog.items, allowedAssistantActionCapabilities, canUseAgents]);

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

    if (availableModelTools.length > 0 && !toolSelectionLocked) {
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

  const compactionCommands = useMemo<ComposerCommandAction[]>(
    () => [
      {
        id: "manual-compaction",
        label: "Compact conversation",
        description: "Summarise older context before the next response.",
        command: "compact",
        icon: <Archive className="h-4 w-4" aria-hidden="true" />,
        isActive: false,
        selectionText: COMPACT_CONVERSATION_COMMAND,
        onSelect: () => setChatInput(COMPACT_CONVERSATION_COMMAND),
      },
    ],
    [setChatInput],
  );
  const skillCommands = useMemo<ComposerCommandAction[]>(
    () =>
      allowedActionItems
        .filter((item) => item.kind === "skill")
        .map((item) => ({
          id: `skill-command-${item.capability.id}`,
          label: item.label,
          description: item.description ?? `Use the ${item.label} skill.`,
          command: item.capability.id,
          icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
          isActive: false,
          actionItem: item,
          onSelect: () => undefined,
        })),
    [allowedActionItems],
  );

  const slashCommands = useMemo(
    () => [
      ...actionVerbCommands,
      ...modeCommands,
      ...skillCommands,
      ...compactionCommands,
      ...settingCommands,
    ],
    [actionVerbCommands, compactionCommands, modeCommands, settingCommands, skillCommands],
  );
  const filteredSlashCommands = useMemo(() => {
    const query = directive?.trigger === "/" ? directive.query : "";
    return slashCommands.filter((command) =>
      matchesComposerCommand(query, [command.label, command.command, command.description]),
    );
  }, [directive, slashCommands]);
  const filteredActionItems = useMemo(() => {
    const query = directive?.trigger === "@" ? directive.query : "";
    return allowedActionItems.filter((item) =>
      matchesComposerCommand(query, [
        item.label,
        item.description,
        item.status,
        ...item.searchText,
      ]),
    );
  }, [allowedActionItems, directive]);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

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
    (item: AssistantActionItem, tokenText = getComposerInlineTokenText(item.label)) => {
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
        ? replaceComposerDirectiveWithCursor(chatInput, directive, tokenText, {
            appendTrailingSpace: true,
          })
        : appendComposerInlineTokenWithCursor(chatInput, item.label, tokenText);
      setSelectedAssistantAction({
        ...selectedAssistantAction,
        item: {
          id: item.id,
          kind: item.kind,
          label: item.label,
          ...(item.launch ? { launch: item.launch } : {}),
          metadata: item.metadata,
        },
        tokenPosition: selection.replacementStart,
        tokenText,
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

  const selectSlashCommand = useCallback(
    (command: ComposerCommandAction) => {
      if (command.disabled) {
        return undefined;
      }
      if (command.actionItem) {
        return selectActionItem(command.actionItem, `/${command.command}`);
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
      selectActionItem,
      selectedAssistantAction,
      setChatInput,
      setSelectedAssistantAction,
    ],
  );

  return {
    agents,
    actionItems: allowedActionItems,
    canUseAgents,
    clearAgent,
    filteredActionItems,
    filteredSlashCommands,
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
