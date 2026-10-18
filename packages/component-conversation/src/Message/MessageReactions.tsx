import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import type { ReactionSummary } from "@ngriffin_uk/polychat-library-chat/reactions";
import { REACTION_PALETTE } from "@ngriffin_uk/polychat-schemas";
import { SmilePlus } from "lucide-react";
import { useState } from "react";

export function MessageReactionChips({
  summaries,
  disabled,
  onToggle,
  align,
}: {
  summaries: readonly ReactionSummary[];
  disabled: boolean;
  onToggle: (emoji: string) => void;
  align: "start" | "end";
}) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Reactions"
      className={cn("flex flex-wrap gap-1", align === "end" ? "justify-end" : "justify-start")}
    >
      {summaries.map((summary) => (
        <li key={summary.emoji}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(summary.emoji)}
            aria-pressed={summary.mine}
            title={summary.byTeammate && !summary.mine ? "Reacted by the teammate" : undefined}
            className={cn(
              "polychat-motion-micro flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-xs transition-colors disabled:cursor-default",
              summary.mine
                ? "border-active-work/40 bg-active-work/10 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden="true">{summary.emoji}</span>
            {summary.count > 1 ? <span className="tabular-nums">{summary.count}</span> : null}
            <span className="sr-only">
              {summary.mine ? `Remove your ${summary.emoji} reaction` : `React ${summary.emoji}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MessageReactionPicker({
  disabled,
  onPick,
  className,
}: {
  disabled: boolean;
  onPick: (emoji: string) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="icon"
          disabled={disabled}
          className={className}
          title="React"
          aria-label="React to this message"
        >
          <SmilePlus size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={6} className="w-auto p-1">
        <fieldset className="flex gap-0.5">
          <legend className="sr-only">Pick a reaction</legend>
          {REACTION_PALETTE.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(emoji);
              }}
              className="polychat-motion-micro flex size-8 cursor-pointer items-center justify-center rounded-lg text-base transition-transform hover:scale-110 hover:bg-selection"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
