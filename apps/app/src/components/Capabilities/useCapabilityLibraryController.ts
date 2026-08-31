import type { CapabilityFilter } from "@ngriffin_uk/polychat-component-capabilities";
import {
  isRecipeConfigured,
  type ModelToolConfiguration,
  parseModelToolConfiguration,
  type AssistantActionItem,
  type SavedToolConfiguration,
  type ProjectCapabilityKind,
  type ModelToolDefinition,
  type SkillAvailability,
} from "@ngriffin_uk/polychat-schemas";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";
import { useMemo, useState } from "react";

import { useRecipeActionRequest } from "~/components/Apps/Recipes/useRecipeActionRequest";
import { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import { useProjectCapabilityCatalog } from "~/hooks/useProjectCapabilityCatalog";
import { useRecipeInstallations } from "~/hooks/useRecipes";
import { useDeleteSkill, usePersonalSkills } from "~/hooks/useSkills";
import { useToolConfigurations } from "~/hooks/useToolConfigurations";
import { useAddProjectCapability, useRemoveProjectCapability } from "~/hooks/useWorkspaces";
import {
  type CapabilitySurface,
  type EnabledCapability,
  getConversationPath,
  getProjectSurface,
  PERSONAL_SURFACE,
} from "~/lib/capability-surfaces";
import {
  filterProjectCapabilities,
  getProjectCapabilityCategories,
  getProjectCapabilityKind,
  groupProjectCapabilities,
} from "~/lib/project-capability-catalog";
import { useChatStore } from "~/state/stores/chatStore";

export interface PersonalSkillControls {
  byId: Map<string, SkillAvailability>;
  error: Error | null;
  pendingSkillId?: string;
  setEnabled: (skillId: string, enabled: boolean) => void;
}

interface CapabilityLibraryScopeBase {
  surface: CapabilitySurface;
  capabilities: EnabledCapability[];
  conversationPath: string;
  error?: Error | null;
  isLoading: boolean;
  name?: string;
  toolConfigurations: SavedToolConfiguration[];
  personalSkills?: PersonalSkillControls;
  saveToolConfiguration: (
    tool: ModelToolDefinition,
    configuration: ModelToolConfiguration,
  ) => Promise<unknown>;
  configurationMutation: CapabilityMutationState;
}

interface CapabilityMutationState {
  isPending: boolean;
  error: Error | null;
  variables?: { capabilityId?: string };
}

export type CapabilityLibraryScope = CapabilityLibraryScopeBase &
  (
    | {
        requiresExplicitEnablement: false;
        canManage?: never;
        add?: never;
        remove?: never;
        projectMutations?: never;
      }
    | {
        requiresExplicitEnablement: true;
        canManage: boolean;
        add: (input: {
          kind: ProjectCapabilityKind;
          capabilityId: string;
          configuration: Record<string, unknown>;
        }) => Promise<unknown>;
        remove: (capability: EnabledCapability & { id: string }) => void;
        projectMutations: {
          add: CapabilityMutationState;
          remove: CapabilityMutationState;
        };
      }
  );

export function useCapabilityLibraryController(scope: CapabilityLibraryScope) {
  const catalog = useProjectCapabilityCatalog(scope.surface.projectId);
  const deleteSkill = useDeleteSkill(scope.surface.projectId);
  const currentUserId = useChatStore((state) => state.user?.id);
  const { data: installationsData } = useRecipeInstallations(scope.surface.projectId);
  const recipeWorkflows = useRecipeWorkflows({
    conversationPath: scope.conversationPath,
    projectId: scope.surface.projectId,
  });
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<CapabilityFilter[]>([]);
  const [category, setCategory] = useState("all");
  const [configurationTool, setConfigurationTool] = useState<ModelToolDefinition | null>(null);
  const [configuration, setConfiguration] = useState<Record<string, unknown>>();

  const items = useMemo(
    () => catalog.items.filter((item) => getProjectCapabilityKind(item) !== null),
    [catalog.items],
  );
  const appById = useMemo(() => new Map(catalog.apps.map((app) => [app.id, app])), [catalog.apps]);
  const recipeById = useMemo(
    () => new Map(catalog.recipes.map((recipe) => [recipe.id, recipe])),
    [catalog.recipes],
  );
  const toolById = useMemo(
    () => new Map<string, ModelToolDefinition>(catalog.tools.map((tool) => [tool.id, tool])),
    [catalog.tools],
  );
  const installationByRecipeId = useMemo(
    () =>
      new Map(
        (installationsData?.installations ?? [])
          .filter((installation) => areUserIdsEqual(installation.userId, currentUserId))
          .map((installation) => [installation.recipeId, installation]),
      ),
    [currentUserId, installationsData?.installations],
  );
  const toolConfigurationById = useMemo(
    () =>
      new Map<string, Record<string, unknown>>(
        scope.toolConfigurations.map((item) => [item.toolId, item.configuration]),
      ),
    [scope.toolConfigurations],
  );
  const configuredItemIds = useMemo(() => {
    const configured = new Set<string>();

    for (const item of items) {
      const kind = getProjectCapabilityKind(item);

      if (kind === "recipe") {
        const recipe = recipeById.get(item.capability.id);
        const installation = installationByRecipeId.get(item.capability.id);

        if (recipe && isRecipeConfigured(recipe, installation)) {
          configured.add(item.id);
        }
      }

      if (kind === "tool") {
        const tool = toolById.get(item.capability.id);
        const projectConfiguration = scope.capabilities.find(
          (capability) =>
            capability.kind === "tool" && capability.capabilityId === item.capability.id,
        )?.configuration;
        const configuration = projectConfiguration ?? toolConfigurationById.get(item.capability.id);

        if (tool && configuration && parseModelToolConfiguration(tool, configuration)) {
          configured.add(item.id);
        }
      }
    }

    return configured;
  }, [
    installationByRecipeId,
    items,
    recipeById,
    scope.capabilities,
    toolById,
    toolConfigurationById,
  ]);
  const kinds = useMemo(
    () =>
      selectedFilters.filter((filter): filter is ProjectCapabilityKind => filter !== "configured"),
    [selectedFilters],
  );
  const itemsForCategories = useMemo(
    () =>
      filterProjectCapabilities(items, {
        category: "all",
        configuredItemIds,
        configuredOnly: selectedFilters.includes("configured"),
        kinds,
        query: "",
      }),
    [configuredItemIds, items, kinds, selectedFilters],
  );
  const categories = useMemo(
    () => getProjectCapabilityCategories(itemsForCategories, []),
    [itemsForCategories],
  );
  const visibleItems = useMemo(
    () =>
      filterProjectCapabilities(items, {
        category,
        configuredItemIds,
        configuredOnly: selectedFilters.includes("configured"),
        kinds,
        query,
      }),
    [category, configuredItemIds, items, kinds, query, selectedFilters],
  );
  const groups = useMemo(() => groupProjectCapabilities(visibleItems), [visibleItems]);

  useRecipeActionRequest(catalog.recipes, installationByRecipeId, recipeWorkflows.actions);

  const addItem = (item: AssistantActionItem, itemKind: ProjectCapabilityKind) => {
    if (!scope.requiresExplicitEnablement) {
      return;
    }

    void scope
      .add({ kind: itemKind, capabilityId: item.capability.id, configuration: {} })
      .catch(() => undefined);
  };

  const removeCapability = (capability: EnabledCapability & { id: string }) => {
    if (!scope.requiresExplicitEnablement) {
      return;
    }

    scope.remove(capability);
  };

  const submitToolConfiguration = async (configuration: ModelToolConfiguration) => {
    if (!configurationTool) {
      return;
    }

    await scope.saveToolConfiguration(configurationTool, configuration);
    setConfigurationTool(null);
    setConfiguration(undefined);
  };

  return {
    catalog: {
      appById,
      error: catalog.error,
      experiences: catalog.experiences,
      groups,
      isLoading: catalog.isLoading,
      recipeById,
      toolById,
    },
    toolConfigurationDialog: {
      configuration,
      close: () => {
        setConfigurationTool(null);
        setConfiguration(undefined);
      },
      isLoading: scope.configurationMutation.isPending,
      open: (tool: ModelToolDefinition, currentConfiguration?: Record<string, unknown>) => {
        setConfigurationTool(tool);
        setConfiguration(currentConfiguration);
      },
      submit: submitToolConfiguration,
      tool: configurationTool,
    },
    filters: {
      categories,
      category,
      selected: selectedFilters,
      query,
      setCategory,
      setSelected: (nextFilters: CapabilityFilter[]) => {
        setSelectedFilters(nextFilters);
        setCategory("all");
      },
      setQuery,
    },
    configurationMutation: scope.configurationMutation,
    projectMutations: scope.requiresExplicitEnablement ? scope.projectMutations : undefined,
    surface: scope.surface,
    capabilities: scope.capabilities,
    toolConfigurationById,
    scopeError: scope.error,
    scopeName: scope.name,
    isLoadingScope: scope.isLoading,
    recipes: {
      installationByRecipeId,
      workflows: recipeWorkflows,
    },
    currentUserId,
    personalSkills: scope.personalSkills,
    skillDeletion: {
      delete: (skillId: string) => deleteSkill.mutateAsync(skillId),
      error: deleteSkill.error,
      isPending: deleteSkill.isPending,
      pendingSkillId: deleteSkill.variables,
      reset: deleteSkill.reset,
    },
    projectActions: scope.requiresExplicitEnablement
      ? { canManage: scope.canManage, addItem, removeCapability }
      : undefined,
  };
}

export function usePersonalCapabilityScope(): CapabilityLibraryScope {
  const configurations = useToolConfigurations();
  const skills = usePersonalSkills();
  const skillsById = useMemo(
    () => new Map((skills.query.data?.skills ?? []).map((skill) => [skill.id, skill])),
    [skills.query.data?.skills],
  );

  return {
    surface: PERSONAL_SURFACE,
    requiresExplicitEnablement: false,
    capabilities: [],
    conversationPath: getConversationPath(PERSONAL_SURFACE),
    isLoading: configurations.query.isLoading || skills.query.isLoading,
    error: configurations.query.error ?? skills.query.error,
    toolConfigurations: configurations.query.data?.configurations ?? [],
    personalSkills: {
      byId: skillsById,
      error: skills.setEnabled.error,
      pendingSkillId: skills.setEnabled.isPending
        ? skills.setEnabled.variables?.skillId
        : undefined,
      setEnabled: (skillId, enabled) => {
        skills.setEnabled.mutate({ skillId, enabled });
      },
    },
    saveToolConfiguration: (tool, configuration) =>
      configurations.save.mutateAsync({ toolId: tool.id, configuration }),
    configurationMutation: {
      isPending: configurations.save.isPending,
      error: configurations.save.error,
      variables: { capabilityId: configurations.save.variables?.toolId },
    },
  };
}

export function useProjectCapabilityScope(
  workspaceId: string,
  projectId: string,
  project: { name?: string; capabilities?: EnabledCapability[] } | undefined,
  role: string | undefined,
  projectError: Error | null,
  isLoading: boolean,
): CapabilityLibraryScope {
  const add = useAddProjectCapability();
  const remove = useRemoveProjectCapability();
  const surface = getProjectSurface(workspaceId, projectId);

  return {
    surface,
    canManage: role === "owner" || role === "admin",
    requiresExplicitEnablement: true,
    capabilities: project?.capabilities ?? [],
    conversationPath: getConversationPath(surface),
    error: projectError,
    isLoading,
    name: project?.name,
    toolConfigurations: [],
    add: (input) => add.mutateAsync({ projectId, input }),
    saveToolConfiguration: (tool, configuration) =>
      add.mutateAsync({
        projectId,
        input: { kind: "tool", capabilityId: tool.id, configuration },
      }),
    remove: (capability) => remove.mutate({ projectId, capabilityId: capability.id }),
    configurationMutation: {
      isPending: add.isPending,
      error: add.error,
      variables: { capabilityId: add.variables?.input.capabilityId },
    },
    projectMutations: {
      add: {
        isPending: add.isPending,
        error: add.error,
        variables: { capabilityId: add.variables?.input.capabilityId },
      },
      remove: {
        isPending: remove.isPending,
        error: remove.error,
        variables: { capabilityId: remove.variables?.capabilityId },
      },
    },
  };
}
