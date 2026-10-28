import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
} from "@ngriffin_uk/polychat-component-ui";
import { formatProviderLabel } from "@ngriffin_uk/polychat-library-react";
import type { SystemModelOption } from "@ngriffin_uk/polychat-schemas";
import { Plus } from "lucide-react";
import { useState } from "react";

export interface ModelChoicePickerProps {
  label: string;
  options: readonly SystemModelOption[];
  disabled?: boolean;
  onPick: (option: SystemModelOption) => void;
}

function matchesQuery(option: SystemModelOption, query: string): boolean {
  const needle = query.trim().toLowerCase();

  return (
    !needle ||
    option.name.toLowerCase().includes(needle) ||
    option.id.toLowerCase().includes(needle) ||
    formatProviderLabel(option.provider).toLowerCase().includes(needle)
  );
}

export function ModelChoicePicker({ label, options, disabled, onPick }: ModelChoicePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = options.filter((option) => matchesQuery(option, query));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          disabled={disabled}
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b border-border p-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search models you can run"
            aria-label="Search models"
            className="[&_input]:py-1.5 [&_input]:text-sm"
          />
        </div>
        <ul aria-label="Models" className="max-h-72 overflow-y-auto p-1">
          {matches.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              {options.length === 0
                ? "Nothing on your account can do this job yet. Add a provider key to widen the list."
                : "No models match that search."}
            </li>
          ) : (
            matches.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-selection focus-visible:bg-selection focus-visible:outline-none"
                  onClick={() => {
                    onPick(option);
                    setOpen(false);
                  }}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <ModelIcon
                      url={option.avatarUrl}
                      modelName={option.name}
                      provider={option.provider}
                      size={16}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {option.name}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {formatProviderLabel(option.provider)}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
