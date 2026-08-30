import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ComposerDirectiveQuery } from "@ngriffin_uk/polychat-library-chat/composer-commands";
import type { AssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import { AtSign, ChevronLeft, ChevronRight, Command, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import type { ComposerCommandAction } from "../composerCommandTypes";
import {
  ASSISTANT_ACTION_ITEM_EMPTY_LABEL,
  ASSISTANT_ACTION_ITEM_SCOPE_LABEL,
  AssistantActionItemIcon,
  describeAssistantActionItem,
  groupAssistantActionItems,
} from "./assistantActionPresentation";
import { useComposerCommandActions } from "./commandActions";
import { ComposerActionMenuRow } from "./ComposerActionMenuRow";

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
  "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-zinc-700 outline-none transition-colors hover:bg-blue-50 hover:text-blue-950 dark:text-zinc-200 dark:hover:bg-blue-950/40 dark:hover:text-blue-100";

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
    canUseAgents,
    exitSlashSubmenu,
    filteredActionItems,
    filteredSlashCommands,
    isLoadingAgents,
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
    <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-off-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      {isSlashDirective && activeSlashCommand ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 border-b border-zinc-200 px-3 py-2 text-left text-xs text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
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
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
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
                    "bg-blue-50 text-blue-950 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-800",
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
          : canUseAgents
            ? groupAssistantActionItems(filteredActionItems).map((group) => (
                <div key={group.label} className="py-1">
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
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
                            "bg-blue-50 text-blue-950 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-800",
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

        {!isSlashDirective && !canUseAgents ? (
          <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
            {ASSISTANT_ACTION_ITEM_SCOPE_LABEL} are available in Chat mode.
          </p>
        ) : null}
        {!isSlashDirective && isLoadingAgents ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading capabilities…
          </div>
        ) : null}
        {resultCount === 0 && !isLoadingAgents ? (
          <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
            No {isSlashDirective ? "actions" : ASSISTANT_ACTION_ITEM_EMPTY_LABEL} match this search.
          </p>
        ) : null}
      </div>
    </div>
  );
}
