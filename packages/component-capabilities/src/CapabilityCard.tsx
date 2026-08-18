import { Button, Card, DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import type {
  AssistantActionItem,
  CapabilityCatalogItem,
  ProjectCapabilityKind,
  ModelToolDefinition,
} from "@ngriffin_uk/polychat-schemas";
import {
  Ellipsis,
  ExternalLink,
  Play,
  Plus,
  Puzzle,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";

import { getIcon, getIconContainerClass } from "./capability-theme";
export interface CapabilityCardProps {
  app?: CapabilityCatalogItem;
  /** True when the capability is already attached to the current scope. */
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
  authoredSkill?: AuthoredSkillCardState;
  /** Supplied when the host can open the capability; the host owns the destination. */
  onOpen?: () => void;
}

export interface SkillCardState {
  alwaysOn: boolean;
  enabled: boolean;
  isPending: boolean;
  onToggle: (enabled: boolean) => void;
}

export interface AuthoredSkillCardState {
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: () => void;
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
  authoredSkill,
  onOpen,
}: CapabilityCardProps) {
  const appIcon = app ? getIcon(app.icon, app.theme) : null;
  const isRunnableTool = kind === "tool" && Boolean(item.metadata?.toolRunnable);
  const canManage = projectActions?.canManage ?? true;
  const requiresExplicitEnablement = Boolean(projectActions);
  const isAlwaysOnSkill = kind === "skill" && !item.capability.savedState.supported;
  const isIncluded =
    !requiresExplicitEnablement || Boolean(isEnabled) || Boolean(tool) || isAlwaysOnSkill;
  const showSkillToggle = Boolean(skill) && !requiresExplicitEnablement;
  const primaryAction = onConfigure
    ? {
        icon: <Settings2 size={15} />,
        label: "Configure",
        onClick: onConfigure,
        requiresManagement: true,
      }
    : onOpen
      ? {
          icon: isRunnableTool ? <Play size={15} /> : <ExternalLink size={15} />,
          label: isRunnableTool ? "Run" : "Open",
          onClick: onOpen,
          requiresManagement: false,
        }
      : null;
  const statusLabel = isAlwaysOnSkill
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
              app ? getIconContainerClass(app.theme) : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            {appIcon ? (
              appIcon
            ) : kind === "tool" ? (
              <Wrench size={18} />
            ) : kind === "skill" ? (
              <Sparkles size={18} />
            ) : (
              <Puzzle size={18} />
            )}
          </span>
          {isIncluded && (
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {statusLabel}
            </span>
          )}
        </div>
        <h4 className="font-semibold">{item.label}</h4>
        <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-500">
          {item.description || item.capability.description}
        </p>
      </div>
      {showSkillToggle && skill ? (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant={skill.enabled ? "outline" : "primary"}
            disabled={skill.alwaysOn || authoredSkill?.isDeleting}
            isLoading={skill.isPending}
            onClick={() => skill.onToggle(!skill.enabled)}
          >
            {skill.alwaysOn ? "Always on" : skill.enabled ? "Turn off" : "Turn on"}
          </Button>
          {authoredSkill?.canDelete && <SkillDeleteMenu authoredSkill={authoredSkill} />}
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
          {authoredSkill?.canDelete ? (
            <SkillDeleteMenu authoredSkill={authoredSkill} />
          ) : (
            isEnabled &&
            projectActions &&
            !authoredSkill &&
            (kind !== "tool" || !tool) && (
              <DropdownMenu
                position="top"
                buttonProps={{
                  "aria-label": "More actions",
                  disabled: !canManage || projectActions.isRemoving,
                  isLoading: projectActions.isRemoving,
                  size: "md",
                  variant: "outline",
                }}
                trigger={<Ellipsis size={16} />}
              >
                <DropdownMenuItem
                  className="text-red-700 dark:text-red-300"
                  icon={<Trash2 size={15} />}
                  onClick={projectActions.onRemove}
                >
                  {requiresExplicitEnablement ? "Remove from project" : "Remove"}
                </DropdownMenuItem>
              </DropdownMenu>
            )
          )}
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

function SkillDeleteMenu({ authoredSkill }: { authoredSkill: AuthoredSkillCardState }) {
  return (
    <DropdownMenu
      position="top"
      buttonProps={{
        "aria-label": "More actions",
        disabled: authoredSkill.isDeleting,
        isLoading: authoredSkill.isDeleting,
        size: "md",
        variant: "outline",
      }}
      trigger={<Ellipsis size={16} />}
    >
      <DropdownMenuItem
        className="text-red-700 dark:text-red-300"
        icon={<Trash2 size={15} />}
        onClick={authoredSkill.onDelete}
      >
        Delete skill
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
