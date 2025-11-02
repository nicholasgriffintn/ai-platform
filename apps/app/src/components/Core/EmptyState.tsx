import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface SuggestionItem {
	label: string;
	onClick: () => void;
}

interface EmptyStateProps {
	/** Display variant - 'empty' for standard empty states, 'welcome' for welcoming first-time users */
	variant?: "empty" | "welcome";
	/** Icon to display (larger in welcome variant) */
	icon?: ReactNode;
	/** Title text or element */
	title?: ReactNode;
	/** Description message */
	message?: string;
	/** Primary action button or element */
	action?: ReactNode;
	/** Suggested actions (displayed as clickable chips) */
	suggestions?: SuggestionItem[];
	/** Custom className */
	className?: string;
}

export const EmptyState = ({
	variant = "empty",
	icon,
	title,
	message,
	action,
	suggestions,
	className,
}: EmptyStateProps) => {
	const isWelcome = variant === "welcome";

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center text-center",
				!isWelcome &&
					"bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl",
				isWelcome ? "px-4 pt-4 pb-2" : "p-8",
				className,
			)}
		>
			{icon && (
				<div
					className={cn(
						"mx-auto flex items-center justify-center rounded-full mb-4",
						isWelcome ? "h-32 w-32" : "h-12 w-12 bg-zinc-100 dark:bg-zinc-700",
					)}
				>
					{icon}
				</div>
			)}
			{title && (
				<h3
					className={cn(
						"font-semibold mb-2 text-zinc-800 dark:text-zinc-200",
						isWelcome ? "md:text-4xl text-2xl" : "text-xl",
					)}
				>
					{title}
				</h3>
			)}
			{message && (
				<p
					className={cn(
						"text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto",
						isWelcome ? "mb-4 mt-2" : "text-sm mb-4",
					)}
				>
					{message}
				</p>
			)}
			{suggestions && suggestions.length > 0 && (
				<div className="flex flex-wrap gap-2 justify-center mt-4 mb-4">
					{suggestions.map((suggestion, index) => (
						<button
							key={index}
							onClick={suggestion.onClick}
							className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
							type="button"
						>
							{suggestion.label}
						</button>
					))}
				</div>
			)}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
};
