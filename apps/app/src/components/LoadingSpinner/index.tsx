import { Loader2 } from "lucide-react";

import { clampPercentage } from "~/lib/percentage";

interface LoadingSpinnerProps {
	message?: string;
	progress?: number;
	className?: string;
}

export const LoadingSpinner = ({ message, progress, className = "" }: LoadingSpinnerProps) => {
	const boundedProgress =
		typeof progress === "number" ? Math.round(clampPercentage(progress)) : undefined;

	return (
		<div
			className={`flex flex-col items-center justify-center gap-2 ${className}`}
			role="status"
			aria-live="polite"
		>
			<div className="relative" aria-hidden="true">
				<Loader2 className="h-8 w-8 animate-spin text-blue-500" />
				{typeof boundedProgress === "number" && (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
							{boundedProgress}%
						</span>
					</div>
				)}
			</div>
			{message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
			{typeof boundedProgress === "number" && (
				<span className="sr-only">{`${message ? ", " : ""}${boundedProgress}% complete`}</span>
			)}
		</div>
	);
};
