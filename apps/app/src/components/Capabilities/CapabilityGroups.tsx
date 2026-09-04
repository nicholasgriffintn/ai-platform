import {
  CapabilityCard,
  CapabilityCategoryGroup,
  CapabilityGroupSection,
  type AuthoredCapabilityCardState,
} from "@ngriffin_uk/polychat-component-capabilities";
import { parseModelToolConfiguration } from "@ngriffin_uk/polychat-schemas";
import type {
  AssistantActionItem,
  AssistantRecipe,
  CapabilityCatalogItem,
  ProjectCapabilityKind,
  ProjectExperienceDefinition,
  ModelToolDefinition,
  RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";
import { useNavigate } from "react-router";

import type { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import {
  type CapabilitySurface,
  type EnabledCapability,
  getCapabilityOpenPath,
} from "~/lib/capability-surfaces";
import type { ProjectCapabilityKindGroup } from "~/lib/project-capability-catalog";
import { getProjectCapabilityKind } from "~/lib/project-capability-catalog";

import { RecipeCapabilityCard } from "./RecipeCapabilityCard";
import type { PersonalSkillControls } from "./useCapabilityLibraryController";

interface CapabilityGroupsProps {
  appById: Map<string, CapabilityCatalogItem>;
  capabilities: EnabledCapability[];
  currentUserId?: string | number;
  groups: ProjectCapabilityKindGroup[];
  experiences: ProjectExperienceDefinition[];
  pendingAddCapabilityId?: string;
  pendingRemoveId?: string;
  onConfigureTool: (tool: ModelToolDefinition, configuration?: Record<string, unknown>) => void;
  projectActions?: {
    canManage: boolean;
    addItem: (item: AssistantActionItem, kind: ProjectCapabilityKind) => void;
    removeCapability: (capability: EnabledCapability & { id: string }) => void;
  };
  personalSkills?: PersonalSkillControls;
  recipeById: Map<string, AssistantRecipe>;
  recipeInstallationById: Map<string, RecipeInstallation>;
  recipeWorkflows: ReturnType<typeof useRecipeWorkflows>;
  toolById: Map<string, ModelToolDefinition>;
  toolConfigurationById: Map<string, Record<string, unknown>>;
  surface: CapabilitySurface;
  authoredSkillActions: AuthoredSkillActions;
  agentActions: AgentCardActions;
}

export interface AuthoredSkillActions {
  canManage: boolean;
  onDelete: (skillId: string, label: string) => void;
  onEdit: (skillId: string) => void;
  pendingSkillId?: string;
}

export interface AgentCardActions {
  canManage: (agentId: string) => boolean;
  canShare: (agentId: string) => boolean;
  onDelete: (agentId: string, label: string) => void;
  onEdit: (agentId: string) => void;
  onShare: (agentId: string) => void;
  pendingAgentId?: string;
}

function resolveAuthoredCapability(
  item: AssistantActionItem,
  itemKind: ProjectCapabilityKind,
  agentActions: AgentCardActions,
  authoredSkillActions: AuthoredSkillActions,
): AuthoredCapabilityCardState | undefined {
  const capabilityId = item.capability.id;

  if (itemKind === "agent") {
    if (!agentActions.canManage(capabilityId)) {
      return undefined;
    }

    return {
      canManage: true,
      isDeleting: agentActions.pendingAgentId === capabilityId,
      onDelete: () => agentActions.onDelete(capabilityId, item.label),
      onEdit: () => agentActions.onEdit(capabilityId),
      onShare: agentActions.canShare(capabilityId)
        ? () => agentActions.onShare(capabilityId)
        : undefined,
    };
  }

  if (item.metadata?.skillSource !== "user-authored") {
    return undefined;
  }

  return {
    canManage: authoredSkillActions.canManage,
    isDeleting: authoredSkillActions.pendingSkillId === capabilityId,
    onDelete: () => authoredSkillActions.onDelete(capabilityId, item.label),
    onEdit: () => authoredSkillActions.onEdit(capabilityId),
  };
}

export function CapabilityGroups({
  appById,
  capabilities,
  currentUserId,
  groups,
  experiences,
  pendingAddCapabilityId,
  pendingRemoveId,
  onConfigureTool,
  personalSkills,
  projectActions,
  recipeById,
  recipeInstallationById,
  recipeWorkflows,
  toolById,
  toolConfigurationById,
  surface,
  authoredSkillActions,
  agentActions,
}: CapabilityGroupsProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <CapabilityGroupSection
          key={group.kind}
          id={group.kind}
          label={group.label}
          count={group.categories.reduce((total, item) => total + item.items.length, 0)}
        >
          {group.categories.map((categoryGroup) => (
            <CapabilityCategoryGroup key={categoryGroup.category} category={categoryGroup.category}>
              <>
                {categoryGroup.items.map((item) => {
                  const itemKind = getProjectCapabilityKind(item);

                  if (!itemKind) {
                    return null;
                  }

                  const existing = capabilities.find(
                    (capability) =>
                      capability.kind === itemKind &&
                      capability.capabilityId === item.capability.id,
                  );
                  const isAdding = pendingAddCapabilityId === item.capability.id;
                  const isRemoving = Boolean(existing) && pendingRemoveId === existing?.id;
                  const recipe =
                    itemKind === "recipe" ? recipeById.get(item.capability.id) : undefined;
                  const canManageCapability = existing
                    ? existing.createdBy === undefined ||
                      areUserIdsEqual(existing.createdBy, currentUserId) ||
                      (existing.kind === "tool" && Boolean(projectActions?.canManage))
                    : projectActions
                      ? itemKind !== "tool" || projectActions.canManage
                      : true;

                  if (recipe) {
                    return (
                      <RecipeCapabilityCard
                        key={item.id}
                        capability={existing}
                        installation={recipeInstallationById.get(recipe.id)}
                        projectActions={
                          projectActions
                            ? {
                                canManage: canManageCapability,
                                isAdding,
                                isRemoving,
                                onAdd: () => projectActions.addItem(item, itemKind),
                                onRemove: () => {
                                  if (existing) {
                                    projectActions.removeCapability(existing);
                                  }
                                },
                              }
                            : undefined
                        }
                        recipe={recipe}
                        workflows={recipeWorkflows}
                      />
                    );
                  }

                  const tool = itemKind === "tool" ? toolById.get(item.capability.id) : undefined;
                  const skillState =
                    itemKind === "skill" && personalSkills
                      ? personalSkills.byId.get(item.capability.id)
                      : undefined;
                  const toolConfiguration =
                    existing?.configuration ?? toolConfigurationById.get(item.capability.id) ?? {};
                  const openPath = getCapabilityOpenPath(item, surface, experiences);

                  return (
                    <CapabilityCard
                      key={item.id}
                      isEnabled={Boolean(existing)}
                      isConfigured={Boolean(
                        tool && parseModelToolConfiguration(tool, toolConfiguration),
                      )}
                      item={item}
                      kind={itemKind}
                      app={appById.get(item.capability.id)}
                      onOpen={openPath ? () => navigate(openPath) : undefined}
                      onConfigure={
                        tool?.requiresConfiguration
                          ? () => onConfigureTool(tool, toolConfiguration)
                          : undefined
                      }
                      projectActions={
                        projectActions
                          ? {
                              canManage: canManageCapability,
                              isAdding,
                              isRemoving,
                              onAdd: () => projectActions.addItem(item, itemKind),
                              onRemove: () => {
                                if (existing) {
                                  projectActions.removeCapability(existing);
                                }
                              },
                            }
                          : undefined
                      }
                      tool={tool}
                      authoredCapability={resolveAuthoredCapability(
                        item,
                        itemKind,
                        agentActions,
                        authoredSkillActions,
                      )}
                      skill={
                        skillState && {
                          alwaysOn: skillState.alwaysOn,
                          enabled: skillState.state === "ready",
                          isPending: personalSkills?.pendingSkillId === skillState.id,
                          onToggle: (enabled) => personalSkills?.setEnabled(skillState.id, enabled),
                        }
                      }
                    />
                  );
                })}
              </>
            </CapabilityCategoryGroup>
          ))}
        </CapabilityGroupSection>
      ))}
    </div>
  );
}
