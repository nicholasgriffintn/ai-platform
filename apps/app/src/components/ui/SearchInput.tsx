import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { useRef } from "react";

import { cn } from "~/lib/utils";

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
				className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
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
					"w-full pl-10 pr-12 py-2 text-sm",
					"rounded-md border border-zinc-300 dark:border-zinc-700",
					"bg-white dark:bg-zinc-900",
					"text-zinc-900 dark:text-zinc-100",
					"placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
					"focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent",
					"transition-colors",
				)}
				{...props}
			/>
			<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
				{value && (
					<button
						type="button"
						onClick={handleClear}
						className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
						aria-label="Clear search"
					>
						<X className="h-4 w-4" aria-hidden="true" />
					</button>
				)}
				{shortcut && !value && (
					<kbd
						className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-300 dark:border-zinc-700"
						aria-hidden="true"
					>
						{shortcut}
					</kbd>
				)}
			</div>
		</div>
	);
}
