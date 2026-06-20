import {
	CalendarClock,
	Clock,
	PauseCircle,
	PlayCircle,
	Plug,
	Settings2,
	Sparkles,
	Trash2,
	WandSparkles,
} from "lucide-react";
import type { AssistantRecipe, RecipeInstallation } from "@assistant/schemas";

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui";
import {
	getRecipeIntegrationStatusLabel,
	getRecipeScheduleTrigger,
	hasSavedRecipeConfiguration,
	recipeKindLabels,
	recipeSupportsSchedule,
} from "~/lib/recipes";
import { cn } from "~/lib/utils";

interface RecipeCardProps {
	recipe: AssistantRecipe;
	installation?: RecipeInstallation;
	onStart: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
	onConfigure: (providerId: string, setupUrl?: string) => void;
	onEditConfiguration: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
	onSchedule: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
	onToggleInstallationStatus: (installation: RecipeInstallation) => void;
	onDeleteInstallation: (installation: RecipeInstallation) => void;
	isStarting: boolean;
	isConfiguring: boolean;
	isEditingConfiguration: boolean;
	isScheduling: boolean;
	isUpdatingInstallation: boolean;
}

export function RecipeCard({
	recipe,
	installation,
	onStart,
	onConfigure,
	onEditConfiguration,
	onSchedule,
	onToggleInstallationStatus,
	onDeleteInstallation,
	isStarting,
	isConfiguring,
	isEditingConfiguration,
	isScheduling,
	isUpdatingInstallation,
}: RecipeCardProps) {
	const connectableIntegrations = recipe.integrations.filter(
		(integration) =>
			integration.connectionStatus === "missing" || integration.connectionStatus === "unknown",
	);
	const hasUnavailableIntegration = recipe.integrations.some(
		(integration) => integration.connectionStatus === "unconfigured",
	);
	const statusIntegrations = recipe.integrations.filter(
		(integration) =>
			integration.connectionStatus !== "missing" && integration.connectionStatus !== "unknown",
	);
	const canSchedule = recipeSupportsSchedule(recipe);
	const scheduleTrigger = getRecipeScheduleTrigger(installation);
	const isPaused = installation?.status === "paused";
	const hasConfiguration = hasSavedRecipeConfiguration(installation);

	return (
		<Card className="flex h-full flex-col border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
			<CardHeader className="space-y-3">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-2">
						<div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
							{recipe.kind === "automate" ? (
								<WandSparkles className="h-4 w-4" />
							) : (
								<Plug className="h-4 w-4" />
							)}
						</div>
						<Badge variant="outline">{recipeKindLabels[recipe.kind]}</Badge>
					</div>
					{recipe.featured && (
						<span
							role="img"
							aria-label="Featured recipe"
							title="Featured recipe"
							className="rounded-full bg-rose-100 p-1.5 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
						>
							<Sparkles className="h-4 w-4" />
						</span>
					)}
				</div>
				<div>
					<CardTitle className="text-lg">{recipe.title}</CardTitle>
					<CardDescription className="mt-1 leading-6">{recipe.summary}</CardDescription>
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{recipe.description}</p>

				<div className="flex flex-wrap gap-2">
					{installation && (
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
								isPaused
									? "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
									: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
							)}
						>
							{isPaused ? "Paused" : "Installed"}
						</span>
					)}
					{hasConfiguration && (
						<span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
							Configured
						</span>
					)}
					{statusIntegrations.map((integration) => (
						<span
							key={integration.id}
							className={cn(
								"inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
								integration.connectionStatus === "connected"
									? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
									: integration.connectionStatus === "not_required"
										? "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
										: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
							)}
						>
							{integration.name}
							<span className="text-[11px] opacity-80">
								{getRecipeIntegrationStatusLabel(integration.connectionStatus)}
							</span>
						</span>
					))}
				</div>

				<div className="flex text-sm text-zinc-600 dark:text-zinc-300">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-zinc-400" />
						<span>{recipe.estimatedSetupMinutes} min setup</span>
					</div>
				</div>

				<div className="mt-auto space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
					{connectableIntegrations.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{connectableIntegrations.map((integration) => (
								<Button
									key={integration.id}
									variant="outline"
									size="xs"
									icon={<Plug className="h-3.5 w-3.5" />}
									onClick={() => onConfigure(integration.providerId, integration.setupUrl)}
									isLoading={isConfiguring}
								>
									Connect {integration.name}
								</Button>
							))}
						</div>
					)}
					<Button
						variant="primary"
						fullWidth
						onClick={() => onStart(recipe, installation)}
						isLoading={isStarting}
						disabled={hasUnavailableIntegration}
					>
						{installation ? "Run in chat" : "Set up in chat"}
					</Button>
					<Button
						variant="secondary"
						fullWidth
						icon={<Settings2 className="h-4 w-4" />}
						onClick={() => onEditConfiguration(recipe, installation)}
						isLoading={isEditingConfiguration}
						disabled={hasUnavailableIntegration}
					>
						{installation ? "Edit configuration" : "Configure"}
					</Button>
					{canSchedule && (
						<Button
							variant="secondary"
							fullWidth
							icon={<CalendarClock className="h-4 w-4" />}
							onClick={() => onSchedule(recipe, installation)}
							isLoading={isScheduling}
							disabled={hasUnavailableIntegration}
						>
							{scheduleTrigger ? "Edit schedule" : "Schedule"}
						</Button>
					)}
					{installation && (
						<div className="grid grid-cols-2 gap-2">
							<Button
								variant="outline"
								size="sm"
								icon={
									isPaused ? (
										<PlayCircle className="h-4 w-4" />
									) : (
										<PauseCircle className="h-4 w-4" />
									)
								}
								onClick={() => onToggleInstallationStatus(installation)}
								isLoading={isUpdatingInstallation}
							>
								{isPaused ? "Resume" : "Pause"}
							</Button>
							<Button
								variant="outline"
								size="sm"
								icon={<Trash2 className="h-4 w-4" />}
								onClick={() => onDeleteInstallation(installation)}
								disabled={isUpdatingInstallation}
							>
								Remove
							</Button>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
