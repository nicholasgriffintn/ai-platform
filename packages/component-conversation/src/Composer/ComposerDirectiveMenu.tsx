import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ComposerDirectiveQuery } from "@ngriffin_uk/polychat-library-chat/composer-commands";
import type { AssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import type { ComposerCommandAction } from "@ngriffin_uk/polychat-utility-react";
import { AtSign, ChevronLeft, ChevronRight, Command, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  ASSISTANT_ACTION_ITEM_EMPTY_LABEL,
  ASSISTANT_ACTION_ITEM_SCOPE_LABEL,
  AssistantActionItemIcon,
  describeAssistantActionItem,
  groupAssistantActionItems,
} from "./assistantActionPresentation.js";
import { useComposerCommandActions } from "./commandActions.js";
import { ComposerActionMenuRow } from "./ComposerActionMenuRow.js";

interface ComposerDirectiveMenuProps {
  activeSuggestionIndex?: number;
  directive: ComposerDirectiveQuery | null;
  isDisabled?: boolean;
  onActionItemSelect?: (item: AssistantActionItem) => void;
  onActiveSuggestionIndexChange?: (index: number) => void;
  onSlashCommandBack?: () => void;
  onSlashCommandSelect?: (command: ComposerCommandAction) => void;
}

const resultClassName =
  "text-popover-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm outline-none transition-colors";

export function ComposerDirectiveMenu({
  activeSuggestionIndex = 0,
  directive,
  isDisabled = false,
  onActionItemSelect,
  onActiveSuggestionIndexChange,
  onSlashCommandBack,
  onSlashCommandSelect,
}: ComposerDirectiveMenuProps) {
  const {
    activeSlashCommand,
    canUseTeammates,
    exitSlashSubmenu,
    filteredActionItems,
    filteredSlashCommands,
    isLoadingTeammates,
    selectActionItem,
    selectSlashCommand,
  } = useComposerCommandActions();
  const listRef = useRef<HTMLDivElement>(null);
  const isSlashDirective = directive?.trigger === "/";
  const resultCount = isSlashDirective ? filteredSlashCommands.length : filteredActionItems.length;
  const highlightedIndex = Math.min(activeSuggestionIndex, Math.max(resultCount - 1, 0));

  useEffect(() => {
    const list = listRef.current;
    const highlightedRow = list?.querySelector<HTMLElement>(
      '[data-composer-command-highlighted="true"]',
    );

    if (!list || !highlightedRow) {
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const rowBounds = highlightedRow.getBoundingClientRect();

    if (rowBounds.top < listBounds.top) {
      list.scrollTop -= listBounds.top - rowBounds.top;
    } else if (rowBounds.bottom > listBounds.bottom) {
      list.scrollTop += rowBounds.bottom - listBounds.bottom;
    }
  }, [directive?.query, highlightedIndex]);

  if (!directive || isDisabled) {
    return null;
  }

  return (
    <div className="absolute right-0 bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-[var(--polychat-elevated-shadow)]">
      {isSlashDirective && activeSlashCommand ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (onSlashCommandBack) {
              onSlashCommandBack();
            } else {
              exitSlashSubmenu();
            }
          }}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium">{activeSlashCommand.label}</span>
          <span>Back to actions</span>
        </button>
      ) : (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {isSlashDirective ? (
            <Command className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{isSlashDirective ? "Actions" : ASSISTANT_ACTION_ITEM_SCOPE_LABEL}</span>
        </div>
      )}
      <div ref={listRef} className="max-h-80 overflow-y-auto pt-1">
        {isSlashDirective
          ? filteredSlashCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                aria-current={index === highlightedIndex ? "true" : undefined}
                disabled={command.disabled}
                data-composer-command-highlighted={index === highlightedIndex ? "true" : undefined}
                className={cn(
                  resultClassName,
                  index === highlightedIndex &&
                    "bg-accent text-accent-foreground ring-1 ring-active-work/40 ring-inset",
                  command.disabled && "cursor-not-allowed opacity-50",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onPointerMove={() => onActiveSuggestionIndexChange?.(index)}
                onClick={() => {
                  if (onSlashCommandSelect) {
                    onSlashCommandSelect(command);
                  } else {
                    selectSlashCommand(command);
                  }
                }}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <ComposerActionMenuRow
                    icon={command.icon}
                    label={activeSlashCommand ? command.label : `/${command.command}`}
                    description={
                      command.disabled
                        ? (command.disabledReason ?? command.description)
                        : command.description
                    }
                    isActive={command.isActive}
                  />
                  {command.options?.length ? (
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            ))
          : canUseTeammates
            ? groupAssistantActionItems(filteredActionItems).map((group) => (
                <div key={group.label} className="py-1">
                  <div className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const index = filteredActionItems.findIndex(
                      (candidate) => candidate.id === item.id,
                    );

                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={index === highlightedIndex ? "true" : undefined}
                        data-composer-command-highlighted={
                          index === highlightedIndex ? "true" : undefined
                        }
                        className={cn(
                          resultClassName,
                          index === highlightedIndex &&
                            "bg-accent text-accent-foreground ring-1 ring-active-work/40 ring-inset",
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onPointerMove={() => onActiveSuggestionIndexChange?.(index)}
                        onClick={() => {
                          if (onActionItemSelect) {
                            onActionItemSelect(item);
                          } else {
                            selectActionItem(item);
                          }
                        }}
                      >
                        <ComposerActionMenuRow
                          icon={<AssistantActionItemIcon item={item} />}
                          label={`@${item.label}`}
                          description={describeAssistantActionItem(item)}
                        />
                      </button>
                    );
                  })}
                </div>
              ))
            : null}

        {!isSlashDirective && !canUseTeammates ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {ASSISTANT_ACTION_ITEM_SCOPE_LABEL} are available in Chat mode.
          </p>
        ) : null}
        {!isSlashDirective && isLoadingTeammates ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading capabilities…
          </div>
        ) : null}
        {resultCount === 0 && !isLoadingTeammates ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No {isSlashDirective ? "actions" : ASSISTANT_ACTION_ITEM_EMPTY_LABEL} match this search.
          </p>
        ) : null}
      </div>
    </div>
  );
}
