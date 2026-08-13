import { X } from "lucide-react";
import { Link } from "react-router";

import { cn } from "~/lib/utils";
import type { ComposerBannerDescriptor, ComposerBannerTone } from "./useComposerBanner";

const toneClasses: Record<ComposerBannerTone, string> = {
	info: "border-zinc-200 bg-off-white text-zinc-700 dark:border-zinc-700 dark:bg-[#121212] dark:text-zinc-300",
	warning:
		"border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
	critical:
		"border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200",
};

const actionClasses: Record<ComposerBannerTone, string> = {
	info: "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
	warning:
		"border-amber-400 bg-amber-50 text-amber-900 hover:bg-white dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-950",
	critical:
		"border-red-400 bg-red-50 text-red-900 hover:bg-white dark:border-red-700 dark:bg-red-950/60 dark:text-red-100 dark:hover:bg-red-950",
};

interface ComposerBannerCardProps {
	banner: ComposerBannerDescriptor;
	onDismiss?: () => void;
}

export function ComposerBannerCard({ banner, onDismiss }: ComposerBannerCardProps) {
	return (
		<div
			role={banner.tone === "critical" ? "alert" : "status"}
			className={cn("mb-3 rounded-lg border px-4 py-3 shadow-sm", toneClasses[banner.tone])}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 text-sm">
					{banner.title && <p className="font-medium">{banner.title}</p>}
					<p className={cn(banner.title && "mt-0.5 text-xs opacity-90")}>{banner.message}</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{banner.action && (
						<Link
							to={banner.action.to}
							className={cn(
								"rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap no-underline",
								actionClasses[banner.tone],
							)}
						>
							{banner.action.label}
						</Link>
					)}
					{onDismiss && (
						<button
							type="button"
							aria-label={
								banner.dismissal?.scope === "day" ? "Dismiss for today" : "Dismiss notification"
							}
							className="rounded p-1 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
							onClick={onDismiss}
						>
							<X size={14} aria-hidden="true" />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
