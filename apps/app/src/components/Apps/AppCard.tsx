import { Crown, Lock } from "lucide-react";
import type { DynamicAppCatalogItem as AppListItem } from "@assistant/schemas";
import { Card } from "~/components/ui";
import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import { getBadgeClass, getCardGradient, getIcon, getIconContainerClass } from "./utils";

interface AppCardProps {
	app: AppListItem;
	onSelect: () => void;
	isWrappedInGroup?: boolean;
}

export const AppCard = ({ app, onSelect, isWrappedInGroup = false }: AppCardProps) => {
	const { isAuthenticated, isPro } = useChatStore();
	const isPremium = app.type === "premium";
	const requiresSignIn = app.type === "byok" && !isAuthenticated;
	const isDisabled = (isPremium && !isPro) || requiresSignIn;

	return (
		<Card
			tabIndex={isDisabled ? -1 : 0}
			onClick={isDisabled ? undefined : onSelect}
			onKeyDown={(e) => !isDisabled && e.key === "Enter" && onSelect()}
			aria-label={`Open ${app.name}${isPremium ? " (Premium)" : ""}${requiresSignIn ? " (Sign in required)" : ""}`}
			aria-disabled={isDisabled}
			className={cn(
				"p-5 shadow-none relative",
				!isWrappedInGroup && "group",
				isDisabled
					? "cursor-not-allowed opacity-60"
					: "cursor-pointer hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-600",
				"w-full h-full",
				"transition-all duration-200",
				"focus:outline-none focus:ring-2 focus:ring-blue-500/40",
				"bg-transparent",
				"bg-gradient-to-br",
				getCardGradient(app.theme),
			)}
		>
			{isDisabled && (
				<div className="absolute top-3 right-3 z-10">
					<div
						className={cn(
							"p-1.5 rounded-full",
							isDisabled ? "bg-zinc-400 dark:bg-zinc-600" : "bg-amber-500 dark:bg-amber-600",
						)}
						title={requiresSignIn ? "Sign in required" : "Premium Feature"}
					>
						{requiresSignIn ? (
							<Lock className="w-4 h-4 text-white" />
						) : (
							<Crown className="w-4 h-4 text-white" />
						)}
					</div>
				</div>
			)}

			<div className={cn("flex flex-col h-full", isDisabled && "pr-10")}>
				<div className="flex flex-col space-y-2 md:flex-row md:items-start md:space-y-0 md:space-x-4 mb-3">
					<div
						className={cn(
							"p-3 rounded-lg shadow-sm flex-shrink-0",
							getIconContainerClass(app.theme),
						)}
					>
						{getIcon(app.icon, app.theme)}
					</div>
					<div className="flex flex-col items-start flex-grow min-w-0">
						<h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 group-hover:underline">
							{app.name}
						</h3>
						{app.category && (
							<span
								className={cn(
									"inline-flex items-center px-3 py-1 text-xs rounded-full mt-1 no-underline",
									getBadgeClass(app.theme),
								)}
							>
								{app.category}
							</span>
						)}
					</div>
				</div>

				<p className="text-zinc-600 dark:text-zinc-300 text-sm mb-4 flex-grow text-left overflow-x-hidden no-underline">
					{app.description}
				</p>
			</div>
		</Card>
	);
};
