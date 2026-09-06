import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { useRef } from "react";

import { cn } from "./utils";

interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> {
  /** Current search value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Optional clear handler (if different from setting value to empty) */
  onClear?: () => void;
  /** Keyboard shortcut hint to display */
  shortcut?: string;
  /** Custom className */
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  shortcut,
  className,
  ...props
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChange("");
    }

    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </div>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full py-2 pr-12 pl-10 text-sm",
          "rounded-md border border-border",
          "bg-surface text-foreground",
          "placeholder:text-muted-foreground",
          "focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none",
          "transition-colors",
        )}
        {...props}
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-selection hover:text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {shortcut && !value && (
          <kbd
            className="hidden rounded border border-border bg-selection px-2 py-0.5 font-mono text-xs text-muted-foreground sm:inline-block"
            aria-hidden="true"
          >
            {shortcut}
          </kbd>
        )}
      </div>
    </div>
  );
}
