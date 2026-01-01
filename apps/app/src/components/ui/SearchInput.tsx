import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";

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
	const handleClear = () => {
		if (onClear) {
			onClear();
		} else {
			onChange("");
		}
	};

	return (
		<div className={cn("relative", className)}>
			<div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
				<Search className="h-4 w-4" />
			</div>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className={cn(
					"w-full pl-10 pr-10 py-2 text-sm",
					"rounded-md border border-zinc-300 dark:border-zinc-700",
					"bg-white dark:bg-zinc-900",
					"text-zinc-900 dark:text-zinc-100",
					"placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
					"focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent",
					"transition-colors",
				)}
				{...props}
			/>
			<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
				{value && (
					<button
						type="button"
						onClick={handleClear}
						className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
						aria-label="Clear search"
					>
						<X className="h-4 w-4" />
					</button>
				)}
				{shortcut && !value && (
					<kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-300 dark:border-zinc-700">
						{shortcut}
					</kbd>
				)}
			</div>
		</div>
	);
}
