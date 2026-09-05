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
          className="border-attention/45 bg-attention/12 text-attention"
          kind="attachment"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-attention">
            {attachment.preview}
          </span>
          <span className="truncate">{attachment.label}</span>
          {attachment.onClear ? (
            <ChipRemoveButton
              onClick={attachment.onClear}
              className="rounded-sm text-attention hover:text-attention"
              label="Remove attachment"
            />
          ) : null}
        </ContextChip>
      ))}
      {activeMode && (
        <ContextChip kind="mode" className="border-success/45 bg-success/12 text-success">
          <span
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-success"
            aria-hidden="true"
          >
            {activeMode.icon}
          </span>
          <span className="truncate">{activeMode.label}</span>
          {props.onClearMode && (
            <ChipRemoveButton
              onClick={props.onClearMode}
              className="rounded-sm text-success hover:text-success"
              label={`Clear ${activeMode.label} mode`}
            />
          )}
        </ContextChip>
      )}
      {props.goal && (
        <ContextChip kind="mode" className="border-creative/45 bg-creative/12 text-creative">
          <Target className="h-3.5 w-3.5 shrink-0 text-creative" aria-hidden="true" />
          <span className="truncate">{props.goal.label}</span>
          {props.goal.onClear && (
            <ChipRemoveButton
              onClick={props.goal.onClear}
              className="rounded-sm text-creative hover:text-creative"
              label="Cancel goal"
            />
          )}
        </ContextChip>
      )}
      {shouldShowAgent && (
        <ContextChip
          kind="agent"
          className="border-active-work/45 bg-active-work/12 text-active-work"
        >
          <AtSign className="h-3.5 w-3.5 shrink-0 text-active-work" aria-hidden="true" />
          <span className="truncate">{selectedAgent.name}</span>
          <ChipRemoveButton
            onClick={clearAgent}
            className="rounded-sm text-active-work hover:text-active-work"
            label={`Clear ${selectedAgent.name} agent`}
          />
        </ContextChip>
      )}
    </div>
  );
}
