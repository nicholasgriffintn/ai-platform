import { clearModelResponseSettings } from "@ngriffin_uk/polychat-library-chat";
import { COMPACT_CONVERSATION_COMMAND } from "@ngriffin_uk/polychat-library-chat/compaction-command";
import {
  appendComposerInlineTokenWithCursor,
  type ComposerDirectiveQuery,
  getComposerInlineTokenText,
  matchesComposerCommand,
  removeComposerDirective,
  replaceComposerDirectiveWithCursor,
} from "@ngriffin_uk/polychat-library-chat/composer-commands";
import type { ChatSettings } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type { GoalCommand } from "@ngriffin_uk/polychat-library-chat/goal-command";
import type { ModelToolId } from "@ngriffin_uk/polychat-library-chat/model-tools";
import {
  formatVerbosityLabel,
  getDefaultVerbosity,
  getVerbosityOptions,
} from "@ngriffin_uk/polychat-library-chat/verbosity";
import { useToolsStore, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useAssistantActionCatalog,
  useModels,
  useModelToolOptions,
  useTeammates,
  useWebLLMModels,
} from "@ngriffin_uk/polychat-library-react";
import {
  EMPTY_MODEL_CONFIG,
  getDefaultModelId,
  formatReasoningLabel,
  getAvailableModels,
  getDefaultReasoningEffort,
  getReasoningOptions,
  isActiveModel,
  isModelSelectableForAccount,
  MODEL_TIER_DEFINITIONS,
} from "@ngriffin_uk/polychat-schemas";
import type {
  AssistantActionItem,
  AssistantActionItemKind,
  AssistantActionVerbId,
  ProjectCapabilityKind,
  ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";
import type {
  ComposerActionCatalogConfig,
  ComposerAssistantActionCapability,
  ComposerCommandAction,
  ComposerTeammateOption,
} from "@ngriffin_uk/polychat-utility-react";
import {
  Archive,
  BookOpen,
  Brain,
  Code,
  Cpu,
  Database,
  Image,
  Layers,
  Link,
  ListFilter,
  Search,
  Target,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import { getComposerCommandMenuState } from "../../Composer/composerCommandNavigation.js";

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

export function useComposerCommandActions({
  allowedAssistantActionCapabilities,
  assistantActionCatalog,
  chatInput,
  directive,
  goalState,
  includeSettingCommands = true,
  modeCommands,
  setChatInput,
  toolSelectionLocked: toolSelectionLockedOverride = false,
}: {
  allowedAssistantActionCapabilities?: readonly ComposerAssistantActionCapability[];
  assistantActionCatalog?: ComposerActionCatalogConfig;
  chatInput: string;
  directive: ComposerDirectiveQuery | null;
  goalState?: {
    canUseGoals: boolean;
    goal: { status: string } | null;
    onCommand?: (command: GoalCommand) => void;
  };
  includeSettingCommands?: boolean;
  modeCommands: ComposerCommandAction[];
  setChatInput: (value: string) => void;
  toolSelectionLocked?: boolean;
}) {
  const {
    chatMode,
    computeSite,
    chatSettings,
    isPro,
    model,
    modelTier,
    selectedAssistantAction,
    selectedTeammateId,
    setChatMode,
    setChatSettings,
    setModel,
    setModelTier,
    setSelectedAssistantAction,
    setSelectedTeammateId,
    setSelectedTeammateTokenPosition,
    setUseMultiModel,
    useMultiModel,
  } = useChatStore();
  const isComposingGoal = useChatStore((state) => state.isComposingGoal);
  const setComposingGoal = useChatStore((state) => state.setComposingGoal);
  const includeTeammates = assistantActionCatalog?.includeTeammates !== false;
  const { teammates, isLoadingTeammates } = useTeammates({ enabled: includeTeammates });
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const webLLMModels = useWebLLMModels({ enabled: computeSite === "browser" });
  const selectedTools = useToolsStore((state) => state.selectedTools);
  const setSelectedTools = useToolsStore((state) => state.setSelectedTools);

  const availableModels = useMemo(
    () => getAvailableModels(apiModels, computeSite === "browser", webLLMModels),
    [apiModels, computeSite, webLLMModels],
  );
  const defaultModelId = useMemo(() => getDefaultModelId(availableModels), [availableModels]);
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
    includeTeammates,
    modelTools: assistantActionCatalog?.includeTools === false ? [] : availableModelTools,
    projectId: assistantActionCatalog?.projectId,
  });
  const canUseTeammates =
    modeCommands.length === 0 ||
    !modeCommands.some((command) => command.isActive && command.command !== "chat");
  const toolSelectionLocked =
    toolSelectionLockedOverride || (chatMode === "agent" && selectedTeammateId !== null);
  const allowedActionItems = useMemo(() => {
    if (!canUseTeammates) {
      return [];
    }

    if (!allowedAssistantActionCapabilities) {
      return actionCatalog.items;
    }

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
  }, [actionCatalog.items, allowedAssistantActionCapabilities, canUseTeammates]);

  const selectModelWithDefaults = useCallback(
    (nextModel: string | null, settings: ChatSettings = chatSettings) => {
      setModel(nextModel);
      setChatSettings(clearModelResponseSettings(settings));
    },
    [chatSettings, setChatSettings, setModel],
  );

  const consumeDirective = useCallback(() => {
    if (!directive) {
      return;
    }

    setChatInput(removeComposerDirective(chatInput, directive));
  }, [chatInput, directive, setChatInput]);

  const modelCommands = useMemo<ComposerCommandAction[]>(
    () => [
      ...[
        {
          id: null,
          label: "Default",
          description: "The project's default tier in Work, otherwise Medium.",
          command: "default",
        },
        ...MODEL_TIER_DEFINITIONS.map((tier) => ({
          id: tier.id,
          label: tier.label,
          description: tier.description,
          command: tier.id,
        })),
      ].map((tier) => ({
        id: `tier-${tier.command}`,
        label: `Tier: ${tier.label}`,
        description: tier.description,
        command: `tier ${tier.command}`,
        icon: <Cpu className="h-4 w-4" aria-hidden="true" />,
        isActive: model === null && modelTier === tier.id,
        disabled: selectedTeammateId !== null,
        disabledReason: "The selected teammate controls the model.",
        onSelect: () => {
          setModelTier(tier.id);
          selectModelWithDefaults(null);
        },
      })),
      ...Object.entries(availableModels)
        .filter(
          ([modelId, modelConfig]) =>
            modelId !== "auto" &&
            isActiveModel(modelConfig) &&
            (modelConfig.isExecutable ?? isModelSelectableForAccount(modelConfig, isPro)),
        )
        .map(([modelId, modelConfig]) => ({
          id: `model-${modelId}`,
          label: `Model: ${modelConfig.name}`,
          description: `Use ${modelConfig.name} for the next response.`,
          command: `model ${modelId}`,
          icon: <Cpu className="h-4 w-4" aria-hidden="true" />,
          isActive: model === modelId,
          disabled: selectedTeammateId !== null,
          disabledReason: "The selected teammate controls the model.",
          onSelect: () => selectModelWithDefaults(modelId),
        })),
    ],
    [
      availableModels,
      isPro,
      model,
      modelTier,
      selectModelWithDefaults,
      selectedTeammateId,
      setModelTier,
    ],
  );
  const modelCommand = useMemo<ComposerCommandAction>(
    () => ({
      id: "model-options",
      label: "Model",
      description: "Choose the model for the next response.",
      command: "model",
      icon: <Cpu className="h-4 w-4" aria-hidden="true" />,
      isActive: false,
      options: modelCommands,
      onSelect: () => undefined,
    }),
    [modelCommands],
  );

  const clearTeammate = useCallback(() => {
    setSelectedTeammateId(null);
    setSelectedTeammateTokenPosition(null);
    if (chatMode === "agent") {
      setChatMode("chat");
      selectModelWithDefaults(defaultModelId ?? null);
    }
  }, [
    chatMode,
    chatSettings,
    defaultModelId,
    selectModelWithDefaults,
    setChatMode,
    setSelectedTeammateId,
    setSelectedTeammateTokenPosition,
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

  const verbosityCommands = useMemo<ComposerCommandAction[]>(
    () =>
      verbosityOptions.map((option) => ({
        id: `verbosity-${option}`,
        label: `Verbosity: ${formatVerbosityLabel(option)}`,
        description: "Choose how detailed responses should be.",
        command: `verbosity ${option}`,
        icon: <ListFilter className="h-4 w-4" aria-hidden="true" />,
        isActive: selectedVerbosity === option,
        onSelect: () =>
          setChatSettings({
            ...chatSettings,
            verbosity: option,
          }),
      })),
    [chatSettings, selectedVerbosity, setChatSettings, verbosityOptions],
  );
  const reasoningCommands = useMemo<ComposerCommandAction[]>(
    () =>
      reasoningOptions.map((option) => ({
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
    [chatSettings, reasoningOptions, selectedReasoning, setChatSettings],
  );
  const toolCommands = useMemo<ComposerCommandAction[]>(
    () =>
      modelToolOptions.map((tool) => {
        const Icon = MODEL_TOOL_ICONS[tool.id];

        return {
          id: `${tool.id}-toggle`,
          label: selectedTools.includes(tool.id) ? `Disable ${tool.label}` : `Enable ${tool.label}`,
          description: tool.available ? tool.description : tool.availabilityReason,
          command: `tools ${tool.id}`,
          icon: <Icon className="h-4 w-4" aria-hidden="true" />,
          isActive: selectedTools.includes(tool.id),
          disabled: !tool.available || toolSelectionLocked,
          disabledReason: toolSelectionLocked
            ? "Tools are controlled by the selected teammate."
            : tool.availabilityReason,
          onSelect: () => toggleTool(tool.id),
        };
      }),
    [modelToolOptions, selectedTools, toggleTool, toolSelectionLocked],
  );
  const settingCommands = useMemo<ComposerCommandAction[]>(() => {
    if (!includeSettingCommands) {
      return [];
    }

    const commands: ComposerCommandAction[] = [
      {
        id: "reasoning-options",
        label: "Reasoning",
        description: "Choose how deeply the model should reason.",
        command: "reasoning",
        icon: <Brain className="h-4 w-4" aria-hidden="true" />,
        isActive: false,
        options: reasoningCommands,
        onSelect: () => undefined,
      },
      {
        id: "verbosity-options",
        label: "Verbosity",
        description: "Choose how detailed responses should be.",
        command: "verbosity",
        icon: <ListFilter className="h-4 w-4" aria-hidden="true" />,
        isActive: false,
        options: verbosityCommands,
        onSelect: () => undefined,
      },
    ];

    if (toolCommands.length > 0) {
      commands.push({
        id: "tool-options",
        label: "Tools",
        description: "Enable or disable tools for the selected model.",
        command: "tools",
        icon: <ListFilter className="h-4 w-4" aria-hidden="true" />,
        isActive: false,
        options: toolCommands,
        onSelect: () => undefined,
      });
    }

    if (isPro && !model && chatMode === "chat") {
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

    return commands;
  }, [
    chatMode,
    includeSettingCommands,
    isPro,
    model,
    reasoningCommands,
    setUseMultiModel,
    toolCommands,
    useMultiModel,
    verbosityCommands,
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
  const canUseGoals = goalState?.canUseGoals;
  const goal = goalState?.goal;
  const runGoalCommand = goalState?.onCommand;
  const goalCommands = useMemo<ComposerCommandAction[]>(() => {
    if (!canUseGoals) {
      return [];
    }

    const commands: ComposerCommandAction[] = [
      {
        id: "goal-set",
        label: isComposingGoal ? "Cancel goal" : goal ? "Replace goal" : "Set a goal",
        description: isComposingGoal
          ? "Stop writing an objective and send an ordinary message."
          : "Keep working until an objective is met, checked against evidence.",
        command: "goal",
        icon: <Target className="h-4 w-4" aria-hidden="true" />,
        isActive: isComposingGoal || Boolean(goal),
        onSelect: () => setComposingGoal(!isComposingGoal),
      },
    ];

    if (runGoalCommand) {
      if (goal?.status === "active") {
        commands.push({
          id: "goal-pause",
          label: "Pause goal",
          description: "Stop continuing the goal until you resume it.",
          command: "goal pause",
          icon: <Target className="h-4 w-4" aria-hidden="true" />,
          isActive: false,
          onSelect: () => runGoalCommand({ kind: "pause" }),
        });
      }

      if (goal?.status !== "active") {
        commands.push({
          id: "goal-resume",
          label: "Resume goal",
          description: "Pick the objective back up.",
          command: "goal resume",
          icon: <Target className="h-4 w-4" aria-hidden="true" />,
          isActive: false,
          onSelect: () => runGoalCommand({ kind: "resume" }),
        });
      }

      commands.push({
        id: "goal-clear",
        label: "Clear goal",
        description: "Drop the objective without completing it.",
        command: "goal clear",
        icon: <Target className="h-4 w-4" aria-hidden="true" />,
        isActive: false,
        onSelect: () => runGoalCommand({ kind: "clear" }),
      });
    }

    if (commands.length === 1) {
      return commands;
    }

    return [
      {
        id: "goal-options",
        label: "Goal",
        description: "Set, pause, resume, replace, or clear the current goal.",
        command: "goal",
        icon: <Target className="h-4 w-4" aria-hidden="true" />,
        isActive: false,
        options: commands,
        onSelect: () => undefined,
      },
    ];
  }, [canUseGoals, goal, isComposingGoal, runGoalCommand, setComposingGoal]);

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

  const slashCommands = useMemo(() => {
    const commands = [
      ...actionVerbCommands,
      ...modeCommands,
      modelCommand,
      ...skillCommands,
      ...goalCommands,
      ...compactionCommands,
      ...settingCommands,
    ];
    const seen = new Set<string>();

    return commands.filter((command) => {
      if (seen.has(command.command)) {
        return false;
      }

      seen.add(command.command);

      return true;
    });
  }, [
    actionVerbCommands,
    compactionCommands,
    goalCommands,
    modeCommands,
    modelCommand,
    settingCommands,
    skillCommands,
  ]);
  const slashCommandMenu = useMemo(() => {
    const query = directive?.trigger === "/" ? directive.query : "";

    return getComposerCommandMenuState(query, slashCommands);
  }, [directive, slashCommands]);
  const filteredSlashCommands = slashCommandMenu.commands;
  const activeSlashCommand = slashCommandMenu.parent;
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

  const selectedTeammate = teammates.find((teammate) => teammate.id === selectedTeammateId);

  const selectTeammate = useCallback(
    (teammate: ComposerTeammateOption) => {
      if (!canUseTeammates) {
        return undefined;
      }

      setSelectedTeammateId(teammate.id);
      const selection = directive
        ? replaceComposerDirectiveWithCursor(chatInput, directive, `@${teammate.name}`, {
            appendTrailingSpace: true,
          })
        : appendComposerInlineTokenWithCursor(chatInput, teammate.name);

      setSelectedTeammateTokenPosition(selection.replacementStart);
      setChatMode("agent");
      selectModelWithDefaults(teammate.model ?? defaultModelId ?? null, {
        ...chatSettings,
      });
      setChatInput(selection.input);

      return selection;
    },
    [
      canUseTeammates,
      chatInput,
      chatSettings,
      directive,
      defaultModelId,
      selectModelWithDefaults,
      setChatMode,
      setChatInput,
      setSelectedTeammateId,
      setSelectedTeammateTokenPosition,
    ],
  );

  const selectActionItem = useCallback(
    (item: AssistantActionItem, tokenText = getComposerInlineTokenText(item.label)) => {
      if (!canUseTeammates) {
        return undefined;
      }

      if (item.kind === "teammate") {
        const teammateId = item.id.replace(/^teammate:/, "");
        const teammate = teammates.find((candidate) => candidate.id === teammateId);

        if (teammate) {
          return selectTeammate(teammate);
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
      teammates,
      canUseTeammates,
      chatInput,
      directive,
      selectTeammate,
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

      if (command.options?.length && directive) {
        const selection = replaceComposerDirectiveWithCursor(
          chatInput,
          directive,
          `/${command.command}`,
          { appendTrailingSpace: true },
        );

        setChatInput(selection.input);

        return selection;
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
        clearTeammate();
      }

      consumeDirective();

      return undefined;
    },
    [
      chatInput,
      clearTeammate,
      consumeDirective,
      directive,
      modeCommands,
      selectActionItem,
      selectedAssistantAction,
      setChatInput,
      setSelectedAssistantAction,
    ],
  );

  const exitSlashSubmenu = useCallback(() => {
    if (!directive || directive.trigger !== "/" || !activeSlashCommand) {
      return undefined;
    }

    const selection = replaceComposerDirectiveWithCursor(chatInput, directive, "/");

    setChatInput(selection.input);

    return selection;
  }, [activeSlashCommand, chatInput, directive, setChatInput]);

  return {
    activeSlashCommand,
    teammates,
    actionItems: allowedActionItems,
    canUseTeammates,
    clearTeammate,
    filteredActionItems,
    filteredSlashCommands,
    exitSlashSubmenu,
    isLoadingTeammates,
    modeCommands,
    selectActionItem,
    selectTeammate,
    selectSlashCommand,
    selectedAssistantAction,
    selectedTeammate,
    selectedTeammateId,
    settingCommands,
    slashCommands,
  };
}
