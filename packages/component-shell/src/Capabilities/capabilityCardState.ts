import type { EnabledCapability } from "@ngriffin_uk/polychat-library-react";
import type { AssistantActionItem, ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";

export interface CapabilityCardState {
  canManage: boolean;
  existing?: EnabledCapability;
  isAdding: boolean;
  isRemoving: boolean;
}

export function resolveCapabilityCardState(
  item: AssistantActionItem,
  itemKind: ProjectCapabilityKind,
  context: {
    canManageProject?: boolean;
    capabilities: EnabledCapability[];
    currentUserId?: string | number;
    pendingAddCapabilityId?: string;
    pendingRemoveId?: string;
  },
): CapabilityCardState {
  const existing = context.capabilities.find(
    (capability) => capability.kind === itemKind && capability.capabilityId === item.capability.id,
  );
  const canManage = existing
    ? existing.createdBy === undefined ||
      areUserIdsEqual(existing.createdBy, context.currentUserId) ||
      (existing.kind === "tool" && Boolean(context.canManageProject))
    : context.canManageProject === undefined
      ? true
      : itemKind !== "tool" || context.canManageProject;

  return {
    canManage,
    existing,
    isAdding: context.pendingAddCapabilityId === item.capability.id,
    isRemoving: Boolean(existing) && context.pendingRemoveId === existing?.id,
  };
}
