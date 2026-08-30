import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { AssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import { AtSign, Target, X } from "lucide-react";
import type { ReactNode } from "react";

import type {
  ComposerActionCatalogConfig,
  ComposerAssistantActionCapability,
  ComposerCommandAction,
} from "../composerCommandTypes";
import { useComposerCommandActions } from "./commandActions";

interface ComposerCommandsState {
  allowedAssistantActionCapabilities?: readonly ComposerAssistantActionCapability[];
  assistantActionCatalog?: ComposerActionCatalogConfig;
  modeCommands: ComposerCommandAction[];
  activeModeControls?: ReactNode;
  directive: { query: string; trigger: "/" | "@" } | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  isDisabled?: boolean;
  activeSuggestionIndex?: number;
  includeSettingCommands?: boolean;
  onActiveSuggestionIndexChange?: (index: number) => void;
  onActionItemSelect?: (item: AssistantActionItem) => void;
  onSlashCommandSelect?: (command: ComposerCommandAction) => void;
  toolSelectionLocked?: boolean;
}

function ContextChip({
  children,
  className,
  kind,
}: {
  children: ReactNode;
  className: string;
  kind: "action" | "agent" | "attachment" | "mode" | "skill";
}) {
  return (
    <span
      data-composer-context-chip={kind}
      contentEditable={false}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ChipRemoveButton({
  className,
  label,
  onClick,
}: {
  className: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={className} aria-label={label} title={label}>
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

interface ComposerAttachmentChipState {
  id: string;
  label: string;
  onClear?: () => void;
  preview: ReactNode;
}

export interface ComposerGoalChipState {
  label: string;
  onClear?: () => void;
}

export function ComposerCommandChips(
  props: ComposerCommandsState & {
    attachments?: ComposerAttachmentChipState[];
    goal?: ComposerGoalChipState;
    hideAgentChip?: boolean;
    onClearMode?: () => void;
  },
) {
  const { clearAgent, selectedAgent } = useComposerCommandActions();
  const activeMode = props.modeCommands.find(
    (command) => command.isActive && command.command !== "chat",
  );

  const shouldShowAgent = selectedAgent && !props.hideAgentChip;

  if (!props.attachments?.length && !activeMode && !shouldShowAgent && !props.goal) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
      {props.attachments?.map((attachment) => (
        <ContextChip
          key={attachment.id}
          className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100"
          kind="attachment"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-amber-700 dark:text-amber-200">
            {attachment.preview}
          </span>
          <span className="truncate">{attachment.label}</span>
          {attachment.onClear ? (
            <ChipRemoveButton
              onClick={attachment.onClear}
              className="rounded-sm text-amber-700 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
              label="Remove attachment"
            />
          ) : null}
        </ContextChip>
      ))}
      {activeMode && (
        <ContextChip
          kind="mode"
          className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100"
        >
          <span
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-emerald-700 dark:text-emerald-200"
            aria-hidden="true"
          >
            {activeMode.icon}
          </span>
          <span className="truncate">{activeMode.label}</span>
          {props.onClearMode && (
            <ChipRemoveButton
              onClick={props.onClearMode}
              className="rounded-sm text-emerald-700 hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-emerald-50"
              label={`Clear ${activeMode.label} mode`}
            />
          )}
        </ContextChip>
      )}
      {props.goal && (
        <ContextChip
          kind="mode"
          className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/35 dark:text-violet-100"
        >
          <Target
            className="h-3.5 w-3.5 shrink-0 text-violet-700 dark:text-violet-200"
            aria-hidden="true"
          />
          <span className="truncate">{props.goal.label}</span>
          {props.goal.onClear && (
            <ChipRemoveButton
              onClick={props.goal.onClear}
              className="rounded-sm text-violet-700 hover:text-violet-950 dark:text-violet-200 dark:hover:text-violet-50"
              label="Cancel goal"
            />
          )}
        </ContextChip>
      )}
      {shouldShowAgent && (
        <ContextChip
          kind="agent"
          className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100"
        >
          <AtSign
            className="h-3.5 w-3.5 shrink-0 text-blue-700 dark:text-blue-200"
            aria-hidden="true"
          />
          <span className="truncate">{selectedAgent.name}</span>
          <ChipRemoveButton
            onClick={clearAgent}
            className="rounded-sm text-blue-700 hover:text-blue-950 dark:text-blue-200 dark:hover:text-blue-50"
            label={`Clear ${selectedAgent.name} agent`}
          />
        </ContextChip>
      )}
    </div>
  );
}
