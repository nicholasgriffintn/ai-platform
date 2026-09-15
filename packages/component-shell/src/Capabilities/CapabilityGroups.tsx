import {
  CapabilityCard,
  CapabilityCategoryGroup,
  CapabilityGroupSection,
  type AuthoredCapabilityCardState,
} from "@ngriffin_uk/polychat-component-capabilities";
import {
  type CapabilitySurface,
  type EnabledCapability,
  getCapabilityOpenPath,
  getProjectCapabilityKind,
  type ProjectCapabilityKindGroup,
} from "@ngriffin_uk/polychat-library-react";
import { parseModelToolConfiguration } from "@ngriffin_uk/polychat-schemas";
import type {
  AssistantActionItem,
  CapabilityCatalogItem,
  ProjectCapabilityKind,
  ProjectExperienceDefinition,
  ModelToolDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { useNavigate } from "react-router";

import { resolveCapabilityCardState } from "./capabilityCardState.js";
import type { PersonalSkillControls } from "./useCapabilityLibraryController.js";

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
  toolById: Map<string, ModelToolDefinition>;
  toolConfigurationById: Map<string, Record<string, unknown>>;
  surface: CapabilitySurface;
  authoredSkillActions: AuthoredSkillActions;
  teammateActions: TeammateCardActions;
}

export interface AuthoredSkillActions {
  canDelete: boolean;
  onDelete: (skillId: string, label: string) => void;
  onEdit: (skillId: string) => void;
  pendingSkillId?: string;
}

export interface TeammateCardActions {
  canManage: (teammateId: string) => boolean;
  canShare: (teammateId: string) => boolean;
  onDelete: (teammateId: string, label: string) => void;
  onEdit: (teammateId: string) => void;
  onShare: (teammateId: string) => void;
  pendingTeammateId?: string;
}

function resolveAuthoredCapability(
  item: AssistantActionItem,
  itemKind: ProjectCapabilityKind,
  teammateActions: TeammateCardActions,
  authoredSkillActions: AuthoredSkillActions,
): AuthoredCapabilityCardState | undefined {
  const capabilityId = item.capability.id;

  if (itemKind === "teammate") {
    if (!teammateActions.canManage(capabilityId)) {
      return undefined;
    }

    return {
      canManage: true,
      isDeleting: teammateActions.pendingTeammateId === capabilityId,
      onDelete: () => teammateActions.onDelete(capabilityId, item.label),
      onEdit: () => teammateActions.onEdit(capabilityId),
      onShare: teammateActions.canShare(capabilityId)
        ? () => teammateActions.onShare(capabilityId)
        : undefined,
    };
  }

  if (item.metadata?.skillSource !== "user-authored") {
    return undefined;
  }

  return {
    canManage: authoredSkillActions.canDelete,
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
  toolById,
  toolConfigurationById,
  surface,
  authoredSkillActions,
  teammateActions,
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

                  const cardState = resolveCapabilityCardState(item, itemKind, {
                    canManageProject: projectActions?.canManage,
                    capabilities,
                    currentUserId,
                    pendingAddCapabilityId,
                    pendingRemoveId,
                  });
                  const { existing } = cardState;
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
                      onOpen={openPath ? () => void navigate(openPath) : undefined}
                      onConfigure={
                        tool?.requiresConfiguration
                          ? () => onConfigureTool(tool, toolConfiguration)
                          : undefined
                      }
                      projectActions={
                        projectActions
                          ? {
                              canManage: cardState.canManage,
                              isAdding: cardState.isAdding,
                              isRemoving: cardState.isRemoving,
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
                        teammateActions,
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
