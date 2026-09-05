import { Button, Card, DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import type {
  AssistantActionItem,
  CapabilityCatalogItem,
  ProjectCapabilityKind,
  ModelToolDefinition,
} from "@ngriffin_uk/polychat-schemas";
import {
  Bot,
  Ellipsis,
  ExternalLink,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  Puzzle,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";

import { getIcon, getIconContainerClass } from "./capability-theme";
export interface CapabilityCardProps {
  app?: CapabilityCatalogItem;
  isEnabled?: boolean;
  isConfigured?: boolean;
  item: AssistantActionItem;
  kind: ProjectCapabilityKind;
  onConfigure?: () => void;
  projectActions?: {
    canManage: boolean;
    isAdding: boolean;
    isRemoving: boolean;
    onAdd: () => void;
    onRemove: () => void;
  };
  tool?: ModelToolDefinition;
  skill?: SkillCardState;
  authoredCapability?: AuthoredCapabilityCardState;
  onOpen?: () => void;
}

export interface SkillCardState {
  alwaysOn: boolean;
  enabled: boolean;
  isPending: boolean;
  onToggle: (enabled: boolean) => void;
}

export interface AuthoredCapabilityCardState {
  canManage: boolean;
  isDeleting: boolean;
  onDelete: () => void;
  onEdit?: () => void;
  onShare?: () => void;
}

export function CapabilityCard({
  app,
  isEnabled,
  isConfigured,
  item,
  kind,
  onConfigure,
  projectActions,
  tool,
  skill,
  authoredCapability,
  onOpen,
}: CapabilityCardProps) {
  const appIcon = app ? getIcon(app.icon, app.theme) : null;
  const isRunnableTool = kind === "tool" && Boolean(item.metadata?.toolRunnable);
  const isUnavailable = item.capability.availability === "unavailable";
  const canManage = projectActions?.canManage ?? true;
  const requiresExplicitEnablement = Boolean(projectActions);
  const isAlwaysOnSkill = kind === "skill" && !item.capability.savedState.supported;
  const isIncluded =
    !requiresExplicitEnablement || Boolean(isEnabled) || Boolean(tool) || isAlwaysOnSkill;
  const showSkillToggle = Boolean(skill) && !requiresExplicitEnablement && !isUnavailable;
  const ownerActions = authoredCapability?.canManage ? authoredCapability : undefined;
  const detachAction =
    isEnabled && projectActions && canManage && (kind !== "tool" || !tool)
      ? projectActions
      : undefined;
  const openAction = isRunnableTool
    ? { icon: <Play size={15} />, label: "Run" }
    : kind === "agent"
      ? { icon: <MessageSquare size={15} />, label: "Start chat" }
      : { icon: <ExternalLink size={15} />, label: "Open" };
  const primaryAction = isUnavailable
    ? null
    : onConfigure
      ? {
          icon: <Settings2 size={15} />,
          label: "Configure",
          onClick: onConfigure,
          requiresManagement: true,
        }
      : onOpen
        ? {
            ...openAction,
            onClick: onOpen,
            requiresManagement: false,
          }
        : null;
  const description = isUnavailable
    ? (item.capability.availabilityReason ?? item.description ?? item.capability.description)
    : item.description || item.capability.description;
  const statusLabel = isUnavailable
    ? "Unavailable"
    : isAlwaysOnSkill
      ? "Always on"
      : skill
        ? skill.alwaysOn
          ? "Always on"
          : skill.enabled
            ? "On"
            : "Off"
        : kind === "tool" && tool?.requiresConfiguration
          ? isConfigured
            ? "Configured"
            : "Configuration required"
          : !requiresExplicitEnablement
            ? "Available"
            : kind === "tool"
              ? isEnabled
                ? "Enabled"
                : "Included"
              : "Enabled";

  return (
    <Card className="justify-between p-5 shadow-none">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              app ? getIconContainerClass(app.theme) : "bg-surface-elevated"
            }`}
          >
            {appIcon ? (
              appIcon
            ) : kind === "tool" ? (
              <Wrench size={18} />
            ) : kind === "skill" ? (
              <Sparkles size={18} />
            ) : kind === "agent" ? (
              <Bot size={18} />
            ) : (
              <Puzzle size={18} />
            )}
          </span>
          {isIncluded && (
            <span className="rounded-full bg-surface-elevated px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {statusLabel}
            </span>
          )}
        </div>
        <h4 className="font-semibold">{item.label}</h4>
        <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {showSkillToggle && skill ? (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant={skill.enabled ? "outline" : "primary"}
            disabled={skill.alwaysOn || authoredCapability?.isDeleting}
            isLoading={skill.isPending}
            onClick={() => skill.onToggle(!skill.enabled)}
          >
            {skill.alwaysOn ? "Always on" : skill.enabled ? "Turn off" : "Turn on"}
          </Button>
          <CapabilityActionsMenu
            detach={detachAction}
            detachLabel={requiresExplicitEnablement ? "Remove from project" : "Remove"}
            kind={kind}
            owner={ownerActions}
          />
        </div>
      ) : isIncluded ? (
        <div className="flex gap-2">
          {primaryAction && (
            <Button
              className="flex-1"
              variant="primary"
              icon={primaryAction.icon}
              disabled={primaryAction.requiresManagement && !canManage}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )}
          <CapabilityActionsMenu
            detach={detachAction}
            detachLabel={requiresExplicitEnablement ? "Remove from project" : "Remove"}
            kind={kind}
            owner={ownerActions}
          />
        </div>
      ) : projectActions ? (
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          isLoading={projectActions.isAdding}
          disabled={!canManage}
          onClick={projectActions.onAdd}
        >
          Add to project
        </Button>
      ) : null}
    </Card>
  );
}

interface CapabilityActionsMenuProps {
  detach?: { isRemoving: boolean; onRemove: () => void };
  detachLabel: string;
  kind: ProjectCapabilityKind;
  owner?: AuthoredCapabilityCardState;
}

function CapabilityActionsMenu({ detach, detachLabel, kind, owner }: CapabilityActionsMenuProps) {
  if (!detach && !owner) {
    return null;
  }

  const isBusy = Boolean(owner?.isDeleting) || Boolean(detach?.isRemoving);

  return (
    <DropdownMenu
      position="top"
      buttonProps={{
        "aria-label": "More actions",
        disabled: isBusy,
        isLoading: isBusy,
        size: "md",
        variant: "outline",
      }}
      trigger={<Ellipsis size={16} />}
    >
      {owner?.onEdit && (
        <DropdownMenuItem icon={<Pencil size={15} />} onClick={owner.onEdit}>
          Edit {kind}
        </DropdownMenuItem>
      )}
      {owner?.onShare && (
        <DropdownMenuItem icon={<Share2 size={15} />} onClick={owner.onShare}>
          Share {kind}
        </DropdownMenuItem>
      )}
      {detach && (
        <DropdownMenuItem
          className="text-failure"
          icon={<Trash2 size={15} />}
          onClick={detach.onRemove}
        >
          {detachLabel}
        </DropdownMenuItem>
      )}
      {owner && (
        <DropdownMenuItem
          className="text-failure"
          icon={<Trash2 size={15} />}
          onClick={owner.onDelete}
        >
          Delete {kind}
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  );
}
